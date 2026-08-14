import crypto from 'crypto';
import type { IEnquiry } from '../models/enquiry.model';
import { BookTranslation } from '../models/book-translation.model';
import { Category } from '../models/category.model';
import { CrmConfig } from '../models/crm-config.model';

/** Only fields that exist on the enquiry (and resolved labels). Never invent values. */
export interface EnquirySummaryFacts {
  enquiryNumber: string;
  source?: string;
  status?: string;
  agentPriority?: string;
  contactName?: string;
  company?: string;
  country?: string;
  phoneCountry?: string;
  phone?: string;
  email?: string;
  subject?: string;
  message?: string;
  requirementText?: string;
  assigned?: boolean;
  needsReview?: boolean;
  nextFollowUpAt?: string;
  interestedBookCount?: number;
  interestedCategoryCount?: number;
  interestedBookTitles?: string[];
  interestedCategoryNames?: string[];
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

export function fingerprintFacts(facts: EnquirySummaryFacts): string {
  return crypto.createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}

export function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

export async function buildEnquirySummaryFacts(doc: IEnquiry): Promise<EnquirySummaryFacts> {
  const [status, priority, bookTitles, categoryNames] = await Promise.all([
    CrmConfig.findById(doc.statusId).select('name slug'),
    CrmConfig.findById(doc.priorityId).select('name slug'),
    resolveBookTitles(doc.interestedBookIds.map((id) => id.toString())),
    resolveCategoryNames(doc.interestedCategoryIds.map((id) => id.toString())),
  ]);

  return compact({
    enquiryNumber: doc.enquiryNumber,
    source: doc.source || undefined,
    status: status?.name || status?.slug || undefined,
    agentPriority: priority?.name || priority?.slug || undefined,
    contactName: doc.contactName?.trim() || undefined,
    company: doc.company?.trim() || undefined,
    country: doc.country || undefined,
    phoneCountry: doc.phoneCountry || undefined,
    phone: doc.phone || undefined,
    email: doc.email?.trim() || undefined,
    subject: doc.subject?.trim() || undefined,
    message: doc.message?.trim() || undefined,
    requirementText: doc.requirementText?.trim() || undefined,
    assigned: Boolean(doc.assignedUserId),
    needsReview: doc.needsReview || undefined,
    nextFollowUpAt: doc.nextFollowUpAt?.toISOString(),
    interestedBookCount: doc.interestedBookIds.length || undefined,
    interestedCategoryCount: doc.interestedCategoryIds.length || undefined,
    interestedBookTitles: bookTitles.length ? bookTitles : undefined,
    interestedCategoryNames: categoryNames.length ? categoryNames : undefined,
  });
}

async function resolveBookTitles(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await BookTranslation.find({ bookId: { $in: ids } }).select('bookId title languageCode');
  const byBook = new Map<string, string>();
  for (const row of rows) {
    const bookId = row.bookId.toString();
    const title = row.title?.trim();
    if (!title) continue;
    const existing = byBook.get(bookId);
    if (!existing || row.languageCode === 'en') {
      byBook.set(bookId, title);
    }
  }
  return [...byBook.values()];
}

async function resolveCategoryNames(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await Category.find({ _id: { $in: ids } }).select('translations');
  return rows
    .map((row) => {
      const en = row.translations.find((t) => t.languageCode === 'en');
      return (en?.name || row.translations[0]?.name || '').trim();
    })
    .filter(Boolean);
}

export function buildEnquirySummaryPrompt(facts: EnquirySummaryFacts): string {
  return [
    'Write a concise internal CRM summary of this book-enquiry.',
    'Use only the facts JSON below. Do not invent customer details, quantities, prices, or contact data.',
    'If a field is missing, omit it. Do not guess. 3–6 factual sentences.',
    '',
    'FACTS:',
    JSON.stringify(facts),
  ].join('\n');
}
