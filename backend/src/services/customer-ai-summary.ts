import crypto from 'crypto';
import type { ICustomer } from '../models/customer.model';
import { hashPrompt } from './enquiry-ai-summary';

/** Only fields that exist on the customer. Never invent values. */
export interface CustomerSummaryFacts {
  customerNumber: string;
  businessName?: string;
  contactName?: string;
  country?: string;
  phoneCountry?: string;
  phoneDialCode?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  city?: string;
  state?: string;
  address?: string;
  tags?: string[];
  needsReview?: boolean;
  isArchived?: boolean;
  merged?: boolean;
  totalEnquiries?: number;
  openEnquiries?: number;
}

function compact<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as T;
}

export function fingerprintCustomerFacts(facts: CustomerSummaryFacts): string {
  return crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}

export { hashPrompt };

export function buildCustomerSummaryFacts(doc: ICustomer): CustomerSummaryFacts {
  return compact({
    customerNumber: doc.customerNumber,
    businessName: doc.businessName?.trim() || undefined,
    contactName: doc.contactName?.trim() || undefined,
    country: doc.country || undefined,
    phoneCountry: doc.phoneCountry || undefined,
    phoneDialCode: doc.phoneDialCode || undefined,
    phone: doc.phone || undefined,
    email: doc.email?.trim() || undefined,
    preferredLanguage: doc.preferredLanguage?.trim() || undefined,
    city: doc.location?.city?.trim() || undefined,
    state: doc.location?.state?.trim() || undefined,
    address: doc.location?.address?.trim() || undefined,
    tags: doc.tags?.length ? doc.tags : undefined,
    needsReview: doc.needsReview || undefined,
    isArchived: doc.isArchived || undefined,
    merged: doc.mergedIntoId ? true : undefined,
    totalEnquiries: doc.stats?.totalEnquiries || undefined,
    openEnquiries: doc.stats?.openEnquiries || undefined,
  });
}

export function buildCustomerSummaryPrompt(facts: CustomerSummaryFacts): string {
  return [
    'Write a concise internal CRM summary of this wholesale book customer.',
    'Use only the facts JSON below. Do not invent business details, contact data, location, interests, orders, enquiry history, or preferences.',
    'If a field is missing, omit it. Do not guess. 3–6 factual sentences.',
    '',
    'FACTS:',
    JSON.stringify(facts),
  ].join('\n');
}
