import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ALL_PERMISSIONS, DEFAULT_PAYMENT_TERMS_SUMMARY } from '@dsb/shared';
import { Customer } from '../models/customer.model';
import { CustomerEvent } from '../models/customer-event.model';
import { Enquiry } from '../models/enquiry.model';
import { EnquiryEvent } from '../models/enquiry-event.model';
import { EnquiryMessage } from '../models/enquiry-message.model';
import { Sequence } from '../models/sequence.model';
import { CrmConfig } from '../models/crm-config.model';
import { FeatureToggle } from '../models/feature-toggle.model';
import { Permission, Role, User } from '../models/user.model';
import { createCustomer, getCustomer, updateCustomer } from '../services/customer.service';
import {
  requestPaymentDateExtension,
  resolvePaymentDateExtension,
  updateCustomerCreditProfile,
} from '../services/credit-profile.service';
import { ensureCrmConfig } from '../services/crm-config.service';
import { ensureFeatureToggles } from '../services/feature.service';
import { buildCustomerSummaryFacts } from '../services/customer-ai-summary';
import { isRealProviderEnabled } from '../services/ai-config';
import { resolveProductionAdapter } from '../services/ai-provider';
import { hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { rupeesToMinor } from '../utils/money';
import { adminCustomerRoutes } from '../routes/customer.routes';

let mongo: MongoMemoryServer;
let adminUserId = '';
let editorUserId = '';
let viewerUserId = '';

const noneConfig = { provider: 'none' as const, hasApiKey: false, dailyTokenBudget: 0 };

async function seedUsers() {
  const perms = [];
  for (const key of ALL_PERMISSIONS) {
    const [module, action] = key.split('.') as [string, string];
    perms.push(
      await Permission.findOneAndUpdate(
        { key },
        { module, action, key, description: key },
        { upsert: true, new: true },
      ),
    );
  }
  const adminRole = await Role.findOneAndUpdate(
    { slug: 'super-admin' },
    {
      name: 'Super Admin',
      slug: 'super-admin',
      isSystem: true,
      isActive: true,
      permissionIds: perms.map((p) => p._id),
      moduleAccess: ['customers'],
    },
    { upsert: true, new: true },
  );
  const editorKeys = ['customers.view', 'customers.create', 'customers.edit'];
  const editorRole = await Role.findOneAndUpdate(
    { slug: 'crm-agent' },
    {
      name: 'CRM Agent',
      slug: 'crm-agent',
      isSystem: true,
      isActive: true,
      permissionIds: perms.filter((p) => editorKeys.includes(p.key)).map((p) => p._id),
      moduleAccess: ['customers'],
    },
    { upsert: true, new: true },
  );
  const viewerRole = await Role.findOneAndUpdate(
    { slug: 'viewer' },
    {
      name: 'Viewer',
      slug: 'viewer',
      isSystem: true,
      isActive: true,
      permissionIds: perms.filter((p) => p.key === 'customers.view').map((p) => p._id),
      moduleAccess: ['customers'],
    },
    { upsert: true, new: true },
  );
  const passwordHash = await hashPassword('Test@123456');
  const admin = await User.create({
    email: 'credit-admin@dsb.local',
    passwordHash,
    name: 'Admin A',
    status: 'active',
    roleIds: [adminRole._id],
  });
  const editor = await User.create({
    email: 'credit-editor@dsb.local',
    passwordHash,
    name: 'Editor',
    status: 'active',
    roleIds: [editorRole._id],
  });
  const viewer = await User.create({
    email: 'credit-viewer@dsb.local',
    passwordHash,
    name: 'Viewer',
    status: 'active',
    roleIds: [viewerRole._id],
  });
  adminUserId = admin._id.toString();
  editorUserId = editor._id.toString();
  viewerUserId = viewer._id.toString();
}

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(adminCustomerRoutes, { prefix: '/api/v1/admin/customers' });
  await app.ready();
  return app;
}

function approvedCreditInput(overrides: Record<string, unknown> = {}) {
  return {
    relationshipType: 'existing' as const,
    creditStatus: 'approved_credit' as const,
    creditLimitMinor: rupeesToMinor(500_000),
    paymentTerms: {
      summary: 'Payment within 3 days after delivery',
      requirePaymentBeforeDispatch: false,
      dueDaysAfterDelivery: 3,
      approvedPaymentDueOn: '2026-08-20T00:00:00.000Z',
    },
    isActive: true,
    reason: 'Credit approved after review',
    ...overrides,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { version: '6.0.14' },
    instance: { launchTimeout: 120_000 },
  });
  await mongoose.connect(mongo.getUri());
  await seedUsers();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    Customer.deleteMany({}),
    CustomerEvent.deleteMany({}),
    Enquiry.deleteMany({}),
    EnquiryEvent.deleteMany({}),
    EnquiryMessage.deleteMany({}),
    Sequence.deleteMany({}),
    CrmConfig.deleteMany({}),
    FeatureToggle.deleteMany({}),
  ]);
  await ensureCrmConfig();
  await ensureFeatureToggles();
});

describe('P3.1 customer credit profile', { timeout: 20_000 }, () => {
  it('supports new, existing, and VIP relationship types without auto-granting credit', async () => {
    const created = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    expect(created.creditProfile.relationshipType).toBe('new');
    expect(created.creditProfile.creditStatus).toBe('no_credit');
    expect(created.creditProfile.paymentTerms.summary).toBe(DEFAULT_PAYMENT_TERMS_SUMMARY);
    expect(created.creditProfile.paymentTerms.requirePaymentBeforeDispatch).toBe(true);
    expect(created.creditProfile.creditLimitMinor).toBeUndefined();
    expect(created.creditProfile.version).toBe(1);

    for (const relationshipType of ['new', 'existing', 'vip'] as const) {
      const customer = await createCustomer({
        businessName: `${relationshipType} Co`,
        contactName: 'Ada',
        phone: relationshipType === 'new' ? '9876543211' : relationshipType === 'existing' ? '9876543212' : '9876543213',
        country: 'IN',
      });
      const updated = await updateCustomerCreditProfile(
        customer.id,
        {
          relationshipType,
          creditStatus: 'no_credit',
          paymentTerms: {
            summary: DEFAULT_PAYMENT_TERMS_SUMMARY,
            requirePaymentBeforeDispatch: true,
          },
          isActive: true,
          reason: `Set type to ${relationshipType} without credit`,
        },
        { id: adminUserId, name: 'Admin A' },
      );
      expect(updated.relationshipType).toBe(relationshipType);
      expect(updated.creditStatus).toBe('no_credit');
      expect(updated.creditLimitMinor).toBeUndefined();
    }
  });

  it('supports no_credit, approved_credit, and credit_suspended', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    expect(customer.creditProfile.creditStatus).toBe('no_credit');

    const approved = await updateCustomerCreditProfile(
      customer.id,
      approvedCreditInput(),
      { id: adminUserId, name: 'Admin B' },
    );
    expect(approved.creditStatus).toBe('approved_credit');
    expect(approved.creditLimitMinor).toBe(50_000_000);
    expect(approved.paymentTerms.summary).toBe('Payment within 3 days after delivery');
    expect(approved.approvedByName).toBe('Admin B');
    expect(approved.approvedAt).toBeTruthy();

    const suspended = await updateCustomerCreditProfile(
      customer.id,
      {
        ...approvedCreditInput({
          creditStatus: 'credit_suspended',
          reason: 'Credit suspended pending review',
        }),
      },
      { id: adminUserId, name: 'Admin A' },
    );
    expect(suspended.creditStatus).toBe('credit_suspended');
    expect(suspended.creditLimitMinor).toBe(50_000_000);
  });

  it('lets authorized admin approve credit and rejects unauthorized HTTP updates', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const app = await buildApp();
    const body = approvedCreditInput();

    const missing = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile`,
      payload: body,
    });
    expect(missing.statusCode).toBe(401);

    const viewer = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile`,
      headers: { authorization: `Bearer ${signAccessToken(viewerUserId)}` },
      payload: body,
    });
    expect(viewer.statusCode).toBe(403);
    expect(viewer.json().error.code).toBe('FORBIDDEN');

    const editor = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile`,
      headers: { authorization: `Bearer ${signAccessToken(editorUserId)}` },
      payload: body,
    });
    expect(editor.statusCode).toBe(403);

    const admin = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile`,
      headers: { authorization: `Bearer ${signAccessToken(adminUserId)}` },
      payload: body,
    });
    expect(admin.statusCode).toBe(200);
    expect(admin.json().data.creditStatus).toBe('approved_credit');
    await app.close();
  });

  it('does not let customer-edit or contact PATCH change the credit profile', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const patched = await updateCustomer(
      customer.id,
      { contactName: 'Ada L' },
      { id: editorUserId, name: 'Editor' },
    );
    expect(patched.contactName).toBe('Ada L');
    expect(patched.creditProfile.creditStatus).toBe('no_credit');

    const app = await buildApp();
    const sneak = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/customers/${customer.id}`,
      headers: { authorization: `Bearer ${signAccessToken(editorUserId)}` },
      payload: {
        contactName: 'Ada L',
        creditStatus: 'approved_credit',
        creditLimitMinor: rupeesToMinor(500_000),
      },
    });
    expect(sneak.statusCode).toBe(200);
    const detail = await getCustomer(customer.id);
    expect(detail.creditProfile.creditStatus).toBe('no_credit');
    expect(detail.creditProfile.creditLimitMinor).toBeUndefined();
    await app.close();
  });

  it('validates credit limit as integer paise and requires it for approved credit', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    await expect(
      updateCustomerCreditProfile(
        customer.id,
        approvedCreditInput({ creditLimitMinor: undefined }),
        { id: adminUserId, name: 'Admin A' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      updateCustomerCreditProfile(
        customer.id,
        approvedCreditInput({ creditLimitMinor: 100.5 }),
        { id: adminUserId, name: 'Admin A' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile`,
      headers: { authorization: `Bearer ${signAccessToken(adminUserId)}` },
      payload: approvedCreditInput({ creditLimitMinor: 12.75 }),
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('stores customer-specific payment terms and preserves previous profile versions', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const v2 = await updateCustomerCreditProfile(
      customer.id,
      approvedCreditInput(),
      { id: adminUserId, name: 'Admin B' },
    );
    expect(v2.version).toBe(2);
    expect(v2.paymentTerms.dueDaysAfterDelivery).toBe(3);

    const v3 = await updateCustomerCreditProfile(
      customer.id,
      approvedCreditInput({
        relationshipType: 'vip',
        paymentTerms: {
          summary: 'Payment within 15 days after delivery',
          requirePaymentBeforeDispatch: false,
          dueDaysAfterDelivery: 15,
          approvedPaymentDueOn: '2026-08-20T00:00:00.000Z',
        },
        reason: 'VIP terms after review',
      }),
      { id: adminUserId, name: 'Admin A' },
    );
    expect(v3.version).toBe(3);
    expect(v3.relationshipType).toBe('vip');
    expect(v3.creditStatus).toBe('approved_credit');

    const detail = await getCustomer(customer.id);
    const commercial = detail.timeline.filter((e) => e.eventType === 'credit_profile_changed');
    expect(commercial.length).toBe(3);
    expect(commercial[0].data.version).toBe(1);
    expect(commercial[0].data.reason).toBe('Initial customer profile');
    expect(commercial[1].actorName).toBe('Admin B');
    expect((commercial[1].data.previous as { creditStatus: string }).creditStatus).toBe('no_credit');
    expect((commercial[1].data.next as { creditStatus: string }).creditStatus).toBe('approved_credit');
    expect(commercial[2].createdAt).toBeTruthy();
    expect(detail.creditProfile.paymentTerms.summary).toBe('Payment within 15 days after delivery');
  });

  it('records a payment-date extension request without changing the approved date', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    await updateCustomerCreditProfile(customer.id, approvedCreditInput(), {
      id: adminUserId,
      name: 'Admin A',
    });
    const requested = await requestPaymentDateExtension(
      customer.id,
      { requestedDueOn: '2026-08-25T00:00:00.000Z', reason: 'Customer asked to pay on 25 Aug' },
      { id: editorUserId, name: 'Editor' },
    );
    expect(requested.paymentTerms.approvedPaymentDueOn).toBe('2026-08-20T00:00:00.000Z');
    expect(requested.pendingPaymentDateRequest?.requestedDueOn).toBe('2026-08-25T00:00:00.000Z');

    await expect(
      resolvePaymentDateExtension(
        customer.id,
        { decision: 'approve', reason: 'Trying to copy the request date' },
        { id: adminUserId, name: 'Admin A' },
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const still = await getCustomer(customer.id);
    expect(still.creditProfile.paymentTerms.approvedPaymentDueOn).toBe('2026-08-20T00:00:00.000Z');
  });

  it('only lets authorized staff approve a new payment date they enter manually', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    await updateCustomerCreditProfile(customer.id, approvedCreditInput(), {
      id: adminUserId,
      name: 'Admin A',
    });
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile/payment-date-extension/request`,
      headers: { authorization: `Bearer ${signAccessToken(editorUserId)}` },
      payload: { requestedDueOn: '2026-08-25T00:00:00.000Z', reason: 'Customer request' },
    });

    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile/payment-date-extension/resolve`,
      headers: { authorization: `Bearer ${signAccessToken(editorUserId)}` },
      payload: {
        decision: 'approve',
        approvedDueOn: '2026-08-25T00:00:00.000Z',
        reason: 'Editor trying to approve',
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const approved = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/customers/${customer.id}/credit-profile/payment-date-extension/resolve`,
      headers: { authorization: `Bearer ${signAccessToken(adminUserId)}` },
      payload: {
        decision: 'approve',
        approvedDueOn: '2026-08-25T00:00:00.000Z',
        reason: 'Admin approved after review',
      },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.paymentTerms.approvedPaymentDueOn).toBe('2026-08-25T00:00:00.000Z');
    expect(approved.json().data.pendingPaymentDateRequest).toBeUndefined();

    const detail = await getCustomer(customer.id);
    const resolved = detail.timeline.find((e) => e.eventType === 'payment_date_extension_resolved');
    expect(resolved?.actorName).toBeTruthy();
    expect(resolved?.data.previousDueOn).toBe('2026-08-20T00:00:00.000Z');
    expect(resolved?.data.newDueOn).toBe('2026-08-25T00:00:00.000Z');
    await app.close();
  });

  it('keeps existing CRM create behaviour and does not call an AI provider', async () => {
    const complete = vi.fn();
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
      phoneCountry: 'NP',
    });
    expect(customer.customerNumber).toMatch(/^CUST-/);
    expect(customer.country).toBe('IN');
    expect(customer.phoneCountry).toBe('NP');
    expect(customer.creditProfile.creditStatus).toBe('no_credit');

    const facts = buildCustomerSummaryFacts((await Customer.findById(customer.id))!);
    expect(JSON.stringify(facts)).not.toMatch(/credit|paymentTerms|creditLimit/i);
    expect(isRealProviderEnabled(noneConfig)).toBe(false);
    expect(resolveProductionAdapter(noneConfig)).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });
});
