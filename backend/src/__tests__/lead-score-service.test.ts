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
import { createCustomer } from '../services/customer.service';
import {
  changeEnquiryStatus,
  createEnquiry,
  getEnquiry,
  setFollowUp,
  updateEnquiry,
} from '../services/enquiry.service';
import { ensureCrmConfig, getPriorityBySlug, getStatusBySlug } from '../services/crm-config.service';
import { isRealProviderEnabled } from '../services/ai-config';

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

describe('enquiry lead score persistence', () => {
  it('stores a score on create without changing agent priority or calling a provider', async () => {
    expect(
      isRealProviderEnabled({ provider: 'none', hasApiKey: false, dailyTokenBudget: 0 }),
    ).toBe(false);

    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Need books',
    });

    expect(enquiry.priority?.slug).toBe('normal');
    expect(enquiry.leadScore).toBeTruthy();
    expect(enquiry.leadScore?.suggestedPriority).toBe('normal');
    expect(['low', 'normal', 'high']).toContain(enquiry.leadScore?.suggestedPriority);
    expect(enquiry.leadScore?.suggestedPriority).not.toBe('medium');

    const stored = await Enquiry.findById(enquiry.id);
    expect(stored?.priorityId.toString()).toBe(enquiry.priorityId);
    expect(stored?.leadScore?.score).toBe(enquiry.leadScore?.score);
  });

  it('recalculates after a status change to terminal', async () => {
    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Need books',
    });
    const previous = enquiry.leadScore?.score;
    const won = await getStatusBySlug('won');
    const updated = await changeEnquiryStatus(enquiry.id, won.id);
    expect(updated.leadScore?.suggestedPriority).toBe('low');
    expect(updated.leadScore?.score).not.toBe(previous);
    expect(updated.priority?.slug).toBe('normal');
  });

  it('recalculates when follow-up and catalogue interest change', async () => {
    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Need books',
    });
    await updateEnquiry(enquiry.id, {
      interestedBookIds: [new mongoose.Types.ObjectId().toString()],
      requirementText: 'A'.repeat(80),
    });
    const overdue = await setFollowUp(enquiry.id, '2020-01-01T00:00:00.000Z');
    expect(overdue.leadScore?.reasons.some((r) => r.code === 'follow_up_overdue')).toBe(true);
    expect(overdue.leadScore?.reasons.some((r) => r.code === 'interested_items')).toBe(true);
  });

  it('computes a score for existing enquiries that have none stored', async () => {
    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Need books',
    });
    await Enquiry.updateOne({ _id: enquiry.id }, { $unset: { leadScore: 1 } });
    const raw = await Enquiry.findById(enquiry.id);
    expect(raw?.leadScore?.calculatedAt).toBeFalsy();
    expect(raw?.leadScore?.score).toBeUndefined();

    const detail = await getEnquiry(enquiry.id);
    expect(detail.leadScore?.score).toBeGreaterThanOrEqual(0);
    expect(detail.leadScore?.suggestedPriority).toMatch(/^(low|normal|high)$/);
    expect(detail.priority?.slug).toBe('normal');
  });

  it('keeps an explicit agent priority and default CRM priorities intact', async () => {
    const high = await getPriorityBySlug('high');
    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Need books',
      priorityId: high.id,
    });
    expect(enquiry.priority?.slug).toBe('high');
    expect(enquiry.leadScore?.suggestedPriority).toBe('normal');
  });

  it('does not create a second customer when scoring a repeat enquiry', async () => {
    const customer = await createCustomer({
      businessName: 'ABC',
      contactName: 'Ada',
      phone: '9876543210',
      country: 'IN',
    });
    await createEnquiry({
      customerId: customer.id,
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'First',
    });
    const second = await createEnquiry({
      customerId: customer.id,
      source: 'manual',
      contactName: 'Ada',
      company: 'ABC',
      phone: '9876543210',
      country: 'IN',
      message: 'Second',
    });
    expect(second.leadScore?.reasons.some((r) => r.code === 'open_enquiries')).toBe(true);
    expect(await Customer.countDocuments()).toBe(1);
  });
});
