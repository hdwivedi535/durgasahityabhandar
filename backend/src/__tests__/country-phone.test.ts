import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { COUNTRIES, searchCountries } from '@dsb/shared';
import { BOOK_IMPORT_COLUMNS, CATEGORY_IMPORT_COLUMNS } from '@dsb/shared';
import { Customer } from '../models/customer.model';
import { CustomerEvent } from '../models/customer-event.model';
import { Enquiry } from '../models/enquiry.model';
import { EnquiryEvent } from '../models/enquiry-event.model';
import { EnquiryMessage } from '../models/enquiry-message.model';
import { Sequence } from '../models/sequence.model';
import { CrmConfig } from '../models/crm-config.model';
import { createCustomer, updateCustomer } from '../services/customer.service';
import { createEnquiry, getEnquiry, updateEnquiry } from '../services/enquiry.service';
import { ensureCrmConfig } from '../services/crm-config.service';

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

describe('country catalog', () => {
  it('includes all libphonenumber countries including IN and NP', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(200);
    expect(COUNTRIES.some((c) => c.iso === 'IN' && c.dialCode === '91')).toBe(true);
    expect(COUNTRIES.some((c) => c.iso === 'NP' && c.dialCode === '977')).toBe(true);
  });

  it('searches by name, dial code, and ISO', () => {
    expect(searchCountries('Nepal')[0]?.iso).toBe('NP');
    expect(searchCountries('+91').some((c) => c.iso === 'IN')).toBe(true);
    expect(searchCountries('91').some((c) => c.iso === 'IN')).toBe(true);
    expect(searchCountries('IN').some((c) => c.iso === 'IN')).toBe(true);
    expect(searchCountries('np').some((c) => c.iso === 'NP')).toBe(true);
  });
});

describe('independent business country and phone country', () => {
  it('stores Nepal business with an Indian phone', async () => {
    const customer = await createCustomer({
      businessName: 'Kathmandu Books',
      contactName: 'Ada',
      country: 'NP',
      phoneCountry: 'IN',
      phone: '9876543210',
    });
    expect(customer.country).toBe('NP');
    expect(customer.phoneCountry).toBe('IN');
    expect(customer.phoneDialCode).toBe('91');
    expect(customer.phone).toBe('+919876543210');
  });

  it('stores India business with a Nepali phone', async () => {
    const customer = await createCustomer({
      businessName: 'Lucknow Books',
      contactName: 'Ada',
      country: 'IN',
      phoneCountry: 'NP',
      phone: '9841234567',
    });
    expect(customer.country).toBe('IN');
    expect(customer.phoneCountry).toBe('NP');
    expect(customer.phoneDialCode).toBe('977');
    expect(customer.phone).toBe('+9779841234567');
  });

  it('does not change phone country when business country is edited', async () => {
    const created = await createCustomer({
      businessName: 'Shop',
      contactName: 'Ada',
      country: 'NP',
      phoneCountry: 'IN',
      phone: '9876543210',
    });
    const updated = await updateCustomer(created.id, { country: 'AE' });
    expect(updated.country).toBe('AE');
    expect(updated.phoneCountry).toBe('IN');
    expect(updated.phone).toBe('+919876543210');
  });

  it('does not change business country when phone country is edited', async () => {
    const created = await createCustomer({
      businessName: 'Shop',
      contactName: 'Ada',
      country: 'IN',
      phoneCountry: 'IN',
      phone: '9876543210',
    });
    const updated = await updateCustomer(created.id, {
      phoneCountry: 'NP',
      phone: '9841234567',
    });
    expect(updated.country).toBe('IN');
    expect(updated.phoneCountry).toBe('NP');
    expect(updated.phone).toBe('+9779841234567');
  });

  it('treats the same E.164 as a duplicate even when business countries differ', async () => {
    await createCustomer({
      businessName: 'India Co',
      contactName: 'Ada',
      country: 'IN',
      phoneCountry: 'IN',
      phone: '9876543210',
    });
    await expect(
      createCustomer({
        businessName: 'Nepal Co',
        contactName: 'Bob',
        country: 'NP',
        phoneCountry: 'IN',
        phone: '9876543210',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_CUSTOMER' });
  });

  it('creates a public-style enquiry with independent countries', async () => {
    const enquiry = await createEnquiry({
      source: 'website',
      publicSubmit: true,
      contactName: 'Ada',
      company: 'Kathmandu Books',
      country: 'NP',
      phoneCountry: 'IN',
      phone: '9876543210',
      message: 'Need Gita',
    });
    expect(enquiry.country).toBe('NP');
    expect(enquiry.phoneCountry).toBe('IN');
    expect(enquiry.phone).toBe('+919876543210');
    const customer = await Customer.findById(enquiry.customerId);
    expect(customer?.country).toBe('NP');
    expect(customer?.phoneCountry).toBe('IN');
  });

  it('preserves independent fields when editing an enquiry', async () => {
    const enquiry = await createEnquiry({
      source: 'manual',
      contactName: 'Ada',
      company: 'Shop',
      country: 'IN',
      phoneCountry: 'NP',
      phone: '9841234567',
      message: 'Hello',
    });
    const onlyCountry = await updateEnquiry(enquiry.id, { country: 'AE' });
    expect(onlyCountry.country).toBe('AE');
    expect(onlyCountry.phoneCountry).toBe('NP');
    const onlyPhone = await updateEnquiry(enquiry.id, { phoneCountry: 'IN', phone: '9876543210' });
    expect(onlyPhone.country).toBe('AE');
    expect(onlyPhone.phoneCountry).toBe('IN');
    const detail = await getEnquiry(enquiry.id);
    expect(detail.country).toBe('AE');
    expect(detail.phoneCountry).toBe('IN');
  });
});

describe('catalogue import/export', () => {
  it('does not map customer or phone country columns', () => {
    expect(BOOK_IMPORT_COLUMNS.join(',')).not.toMatch(/phoneCountry|customer_country/);
    expect(CATEGORY_IMPORT_COLUMNS.join(',')).not.toMatch(/phoneCountry|customer_country/);
  });
});
