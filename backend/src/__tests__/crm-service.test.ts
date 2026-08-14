import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Customer } from '../models/customer.model';
import { CustomerEvent } from '../models/customer-event.model';
import { Enquiry } from '../models/enquiry.model';
import { EnquiryEvent } from '../models/enquiry-event.model';
import { EnquiryMessage } from '../models/enquiry-message.model';
import { Sequence } from '../models/sequence.model';
import { CrmConfig } from '../models/crm-config.model';
import {
  CustomerError,
  createCustomer,
  matchCustomers,
  mergeCustomers,
  resolveOrCreateCustomer,
} from '../services/customer.service';
import { changeEnquiryStatus, createEnquiry, getEnquiry } from '../services/enquiry.service';
import { ensureCrmConfig, getStatusBySlug } from '../services/crm-config.service';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { version: '6.0.14' },
    instance: { launchTimeout: 120_000 },
  });
  await mongoose.connect(mongo.getUri());
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
  ]);
  await ensureCrmConfig();
});

describe('customer identity (C3)', () => {
  it('creates a customer and rejects a duplicate phone+country', async () => {
    const first = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
      email: 'ada@abc.com',
    });
    expect(first.customerNumber).toMatch(/^CUST-/);
    expect(first.phone).toBe('+919876543210');

    try {
      await createCustomer({
        businessName: 'Other',
        contactName: 'Bob',
        phone: '+91 98765 43210',
        country: 'IN',
      });
      throw new Error('expected duplicate');
    } catch (err) {
      expect(err).toBeInstanceOf(CustomerError);
      expect((err as CustomerError).code).toBe('DUPLICATE_CUSTOMER');
      expect((err as CustomerError).message).toMatch(/already exists/i);
    }
  });

  it('does not treat the same national number in another country as a duplicate', async () => {
    await createCustomer({
      businessName: 'IN Shop',
      contactName: 'Ada',
      phone: '9841234567',
      country: 'IN',
    });
    const np = await createCustomer({
      businessName: 'NP Shop',
      contactName: 'Ada',
      phone: '9841234567',
      phoneCountry: 'NP',
      country: 'NP',
    });
    expect(np.country).toBe('NP');
    expect(np.phoneCountry).toBe('NP');
  });

  it('matches email at 80 and phone at 100', async () => {
    await createCustomer({
      businessName: 'ABC',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
      email: 'ada@abc.com',
    });
    const phoneHit = await matchCustomers({ phone: '9876543210', phoneCountry: 'IN' });
    expect(phoneHit.decision.kind).toBe('exact');
    const emailHit = await matchCustomers({
      phone: '9999999999',
      phoneCountry: 'IN',
      email: 'ada@abc.com',
    });
    expect(emailHit.decision.kind).toBe('exact');
    if (emailHit.decision.kind === 'exact') {
      expect(emailHit.decision.match.score).toBe(80);
    }
  });

  it('public ambiguous match creates a new needsReview customer instead of merging', async () => {
    await createCustomer({
      businessName: 'Phone Co',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
      email: 'ada@phone.com',
    });
    await createCustomer({
      businessName: 'Email Co',
      contactName: 'Bob',
      phone: '9123456789',
      country: 'IN',
      email: 'bob@email.com',
    });

    const result = await resolveOrCreateCustomer({
      businessName: 'New Co',
      contactName: 'Cara',
      phone: '9876543210',
      country: 'IN',
      email: 'bob@email.com',
      publicSubmit: true,
    });
    expect(result.linkedExisting).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.customer.needsReview).toBe(true);
    expect(await Customer.countDocuments({ mergedIntoId: { $exists: false } })).toBe(3);
  });

  it('merge moves enquiries and follows mergedIntoId', async () => {
    const survivor = await createCustomer({
      businessName: 'Keep',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const loser = await createCustomer({
      businessName: 'Drop',
      contactName: 'Bob',
      phone: '9123456789',
      country: 'IN',
    });
    const enquiry = await createEnquiry({
      customerId: loser.id,
      source: 'manual',
      contactName: 'Bob',
      company: 'Drop',
      phone: '9123456789',
      country: 'IN',
      message: 'Need books',
    });
    await mergeCustomers(survivor.id, loser.id);
    const moved = await Enquiry.findById(enquiry.id);
    expect(moved?.customerId.toString()).toBe(survivor.id);
    const linked = await resolveOrCreateCustomer({
      customerId: loser.id,
      businessName: 'Drop',
      contactName: 'Bob',
      phone: '9123456789',
      country: 'IN',
    });
    expect(linked.customer.id).toBe(survivor.id);
  });
});

describe('enquiry timeline (C4)', () => {
  it('links an existing customer on matching phone and appends timeline', async () => {
    const customer = await createCustomer({
      businessName: 'ABC Books',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    const enquiry = await createEnquiry({
      source: 'website',
      publicSubmit: true,
      contactName: 'Ada',
      company: 'ABC Books',
      phone: '9876543210',
      country: 'IN',
      message: 'Need 20 copies of Gita',
      requirementText: '20 copies, Delhi',
    });
    expect(enquiry.customerId).toBe(customer.id);
    expect(enquiry.enquiryNumber).toMatch(/^ENQ-\d{4}-\d+$/);
    expect(enquiry.needsReview).toBe(false);
    const detail = await getEnquiry(enquiry.id);
    expect(detail.timeline.some((t) => t.kind === 'message')).toBe(true);
    expect(detail.timeline.some((t) => t.kind === 'event' && t.item.eventType === 'created')).toBe(
      true,
    );
  });

  it('quotation-sent is a status only and status change appends an event', async () => {
    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Quote please',
    });
    const quoted = await getStatusBySlug('quotation-sent');
    expect(quoted.isTerminal).toBe(false);
    await changeEnquiryStatus(enquiry.id, quoted.id, { name: 'Agent' });
    const won = await getStatusBySlug('won');
    await changeEnquiryStatus(enquiry.id, won.id, { name: 'Agent' });
    const detail = await getEnquiry(enquiry.id);
    const statusEvents = detail.timeline.filter(
      (t) => t.kind === 'event' && t.item.eventType === 'status_changed',
    );
    expect(statusEvents).toHaveLength(2);
    expect(detail.closedAt).toBeTruthy();
    expect(detail.status?.slug).toBe('won');
  });
});
