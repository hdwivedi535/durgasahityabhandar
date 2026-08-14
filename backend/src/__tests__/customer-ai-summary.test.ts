import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ALL_PERMISSIONS } from '@dsb/shared';
import { Customer } from '../models/customer.model';
import { CustomerEvent } from '../models/customer-event.model';
import { Enquiry } from '../models/enquiry.model';
import { EnquiryEvent } from '../models/enquiry-event.model';
import { EnquiryMessage } from '../models/enquiry-message.model';
import { Sequence } from '../models/sequence.model';
import { CrmConfig } from '../models/crm-config.model';
import { FeatureToggle } from '../models/feature-toggle.model';
import { AiRun } from '../models/ai-run.model';
import { AiInsight } from '../models/ai-insight.model';
import { AiTokenCounter } from '../models/ai-token-counter.model';
import { Permission, Role, User } from '../models/user.model';
import { createCustomer, getCustomer } from '../services/customer.service';
import { ensureCrmConfig } from '../services/crm-config.service';
import { ensureFeatureToggles, updateFeatureToggle } from '../services/feature.service';
import { generateCustomerSummary } from '../services/customer-ai.service';
import { buildCustomerSummaryFacts } from '../services/customer-ai-summary';
import { AiError } from '../services/enquiry-ai.service';
import type { AiCompletionAdapter } from '../services/ai-provider';
import { resolveProductionAdapter } from '../services/ai-provider';
import { isRealProviderEnabled } from '../services/ai-config';
import { hashPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { adminCustomerRoutes } from '../routes/customer.routes';

let mongo: MongoMemoryServer;
let adminUserId = '';
let viewerUserId = '';

const noneConfig = { provider: 'none' as const, hasApiKey: false, dailyTokenBudget: 0 };
const readyConfig = {
  provider: 'openai_compatible' as const,
  hasApiKey: true,
  dailyTokenBudget: 10_000,
};

function createMockAdapter(onComplete?: (prompt: string) => void): AiCompletionAdapter {
  return {
    async complete(request) {
      onComplete?.(request.prompt);
      const jsonStart = request.prompt.indexOf('FACTS:');
      const raw = request.prompt.slice(jsonStart + 6).trim();
      const facts = JSON.parse(raw) as Record<string, unknown>;
      const bits: string[] = [];
      if (facts.customerNumber) bits.push(`Customer ${facts.customerNumber}`);
      if (facts.businessName) bits.push(`business ${facts.businessName}`);
      if (facts.contactName) bits.push(`contact ${facts.contactName}`);
      if (facts.country) bits.push(`location country ${facts.country}`);
      if (facts.phoneCountry) bits.push(`phone country ${facts.phoneCountry}`);
      if (facts.email) bits.push(`email ${facts.email}`);
      if (facts.city) bits.push(`city ${facts.city}`);
      return {
        text: bits.join('. ') + '.',
        model: 'mock',
        tokenIn: 20,
        tokenOut: 10,
      };
    },
  };
}

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
  const viewerPerms = perms.filter((p) => p.key === 'customers.view');
  const viewerRole = await Role.findOneAndUpdate(
    { slug: 'viewer' },
    {
      name: 'Viewer',
      slug: 'viewer',
      isSystem: true,
      isActive: true,
      permissionIds: viewerPerms.map((p) => p._id),
      moduleAccess: ['customers'],
    },
    { upsert: true, new: true },
  );
  const passwordHash = await hashPassword('Test@123456');
  const admin = await User.create({
    email: 'cust-ai-admin@dsb.local',
    passwordHash,
    name: 'Customer AI Admin',
    status: 'active',
    roleIds: [adminRole._id],
  });
  const viewer = await User.create({
    email: 'cust-ai-viewer@dsb.local',
    passwordHash,
    name: 'Customer AI Viewer',
    status: 'active',
    roleIds: [viewerRole._id],
  });
  adminUserId = admin._id.toString();
  viewerUserId = viewer._id.toString();
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
    AiRun.deleteMany({}),
    AiInsight.deleteMany({}),
    AiTokenCounter.deleteMany({}),
  ]);
  await ensureCrmConfig();
  await ensureFeatureToggles();
});

describe('customer AI summary', () => {
  it('rejects unauthorized HTTP requests', async () => {
    const app = Fastify();
    await app.register(cookie);
    await app.register(adminCustomerRoutes, { prefix: '/api/v1/admin/customers' });
    await app.ready();
    const missing = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/customers/${new mongoose.Types.ObjectId().toString()}/ai/summary`,
    });
    expect(missing.statusCode).toBe(401);

    const token = signAccessToken(viewerUserId);
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/customers/${new mongoose.Types.ObjectId().toString()}/ai/summary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('FORBIDDEN');
    await app.close();
  });

  it('does not generate when crm_ai is disabled', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const complete = vi.fn();
    await expect(
      generateCustomerSummary(customer.id, adminUserId, {
        config: readyConfig,
        adapter: createMockAdapter(complete),
      }),
    ).rejects.toMatchObject({ code: 'AI_DISABLED' });
    expect(complete).not.toHaveBeenCalled();
    expect(await AiRun.countDocuments()).toBe(0);
  });

  it('fails safely when AI_PROVIDER=none and never calls a provider', async () => {
    await updateFeatureToggle('crm_ai', true);
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const complete = vi.fn();
    expect(isRealProviderEnabled(noneConfig)).toBe(false);
    expect(resolveProductionAdapter(noneConfig)).toBeNull();

    await expect(
      generateCustomerSummary(customer.id, adminUserId, { config: noneConfig }),
    ).rejects.toBeInstanceOf(AiError);
    await expect(
      generateCustomerSummary(customer.id, adminUserId, { config: noneConfig }),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(complete).not.toHaveBeenCalled();
    expect(await AiRun.countDocuments()).toBe(0);

    const token = signAccessToken(adminUserId);
    const app = Fastify();
    await app.register(cookie);
    await app.register(adminCustomerRoutes, { prefix: '/api/v1/admin/customers' });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/customers/${customer.id}/ai/summary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('AI_NOT_CONFIGURED');
    await app.close();
  });

  it('blocks generation when the daily budget is unavailable', async () => {
    await updateFeatureToggle('crm_ai', true);
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const complete = vi.fn();
    await expect(
      generateCustomerSummary(customer.id, adminUserId, {
        config: { provider: 'openai_compatible', hasApiKey: true, dailyTokenBudget: 0 },
        adapter: createMockAdapter(complete),
      }),
    ).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
    expect(complete).not.toHaveBeenCalled();
  });

  it('lets an authorized path generate, store, and leave the customer unchanged', async () => {
    await updateFeatureToggle('crm_ai', true);
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'NP',
      phoneCountry: 'IN',
    });
    const before = await Customer.findById(customer.id);
    const complete = vi.fn();
    const result = await generateCustomerSummary(customer.id, adminUserId, {
      config: readyConfig,
      adapter: createMockAdapter(complete),
    });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.summary.summary).toContain(customer.customerNumber);
    expect(result.summary.summary).toContain('ABC Books');
    expect(result.summary.summary).toContain('location country NP');
    expect(result.summary.summary).toContain('phone country IN');
    expect(result.summary.model).toBe('mock');
    expect(result.run.status).toBe('ok');
    expect(result.run.kind).toBe('customer_summary');
    expect(await AiRun.countDocuments()).toBe(1);
    expect(await AiInsight.countDocuments()).toBe(1);
    const insight = await AiInsight.findOne({ targetId: customer.id });
    expect(insight?.kind).toBe('customer_summary');
    expect(insight?.targetType).toBe('customer');

    const after = await Customer.findById(customer.id);
    expect(after?.businessName).toBe(before?.businessName);
    expect(after?.contactName).toBe(before?.contactName);
    expect(after?.country).toBe(before?.country);
    expect(after?.phoneCountry).toBe(before?.phoneCountry);
    expect(after?.phoneNormalized).toBe(before?.phoneNormalized);
    expect(after?.updatedAt.toISOString()).toBe(before?.updatedAt.toISOString());

    const detail = await getCustomer(customer.id);
    expect(detail.aiSummary?.summary).toBe(result.summary.summary);
    expect(detail.country).toBe('NP');
    expect(detail.phoneCountry).toBe('IN');
  });

  it('does not fabricate missing customer fields', async () => {
    await updateFeatureToggle('crm_ai', true);
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    expect(customer.email).toBeFalsy();
    const facts = buildCustomerSummaryFacts((await Customer.findById(customer.id))!);
    expect(facts.email).toBeUndefined();
    expect(facts.city).toBeUndefined();
    expect(facts.totalEnquiries).toBeUndefined();
    expect(JSON.stringify(facts)).not.toMatch(/@/);
    expect(JSON.stringify(facts)).not.toMatch(/enquiry history|order history|unknown/i);

    const result = await generateCustomerSummary(customer.id, adminUserId, {
      config: readyConfig,
      adapter: createMockAdapter(),
    });
    expect(result.summary.summary).not.toMatch(/@/);
    expect(result.summary.summary.toLowerCase()).not.toContain('unknown email');
    expect(result.summary.summary.toLowerCase()).not.toContain('order history');
  });

  it('records a new run and upserts the insight on repeat generation', async () => {
    await updateFeatureToggle('crm_ai', true);
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const first = await generateCustomerSummary(customer.id, adminUserId, {
      config: readyConfig,
      adapter: {
        async complete() {
          return { text: 'First customer summary.', model: 'mock', tokenIn: 5, tokenOut: 5 };
        },
      },
    });
    const second = await generateCustomerSummary(customer.id, adminUserId, {
      config: readyConfig,
      adapter: {
        async complete() {
          return { text: 'Second customer summary.', model: 'mock', tokenIn: 5, tokenOut: 5 };
        },
      },
    });
    expect(second.run.id).not.toBe(first.run.id);
    expect(await AiRun.countDocuments()).toBe(2);
    expect(await AiInsight.countDocuments()).toBe(1);
    expect(second.summary.summary).toBe('Second customer summary.');
    const insight = await AiInsight.findOne({ targetId: customer.id, kind: 'customer_summary' });
    expect(insight?.output).toBe('Second customer summary.');
  });

  it('keeps Phase 4 customer create behaviour unchanged', async () => {
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
    expect(await AiInsight.countDocuments()).toBe(0);
    const detail = await getCustomer(customer.id);
    expect(detail.aiSummary).toBeUndefined();
    expect(detail.timeline.length).toBeGreaterThan(0);
  });
});
