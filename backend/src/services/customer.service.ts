import type {
  CustomerDetailDto,
  CustomerDto,
  CustomerEventDto,
  CustomerListResult,
  CustomerMatch,
  CustomerLocation,
} from '@dsb/shared';
import mongoose from 'mongoose';
import { Customer, type ICustomer } from '../models/customer.model';
import { CustomerEvent } from '../models/customer-event.model';
import { Enquiry } from '../models/enquiry.model';
import { EnquiryEvent } from '../models/enquiry-event.model';
import { decideMatch, type MatchCandidate } from './customer-match';
import { normalizeEmail, normalizePhone, normalizeCountry, callingCodeFor, PhoneError } from '../utils/phone';
import { nextCustomerNumber } from '../utils/sequence';

export class CustomerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface Actor {
  id?: string;
  name?: string;
}

function toDto(doc: ICustomer): CustomerDto {
  return {
    id: doc._id.toString(),
    customerNumber: doc.customerNumber,
    businessName: doc.businessName,
    contactName: doc.contactName,
    country: doc.country,
    phoneCountry: (doc.phoneCountry || doc.country || 'IN').toUpperCase(),
    phoneDialCode: doc.phoneDialCode || callingCodeFor(normalizeCountry(doc.phoneCountry || doc.country)),
    phone: doc.phone,
    phoneNormalized: doc.phoneNormalized,
    email: doc.email,
    emailNormalized: doc.emailNormalized,
    preferredLanguage: doc.preferredLanguage,
    location: doc.location ?? {},
    tags: doc.tags ?? [],
    stats: {
      totalEnquiries: doc.stats?.totalEnquiries ?? 0,
      openEnquiries: doc.stats?.openEnquiries ?? 0,
    },
    needsReview: doc.needsReview,
    mergedIntoId: doc.mergedIntoId?.toString(),
    isArchived: doc.isArchived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toEventDto(doc: {
  _id: { toString(): string };
  customerId: { toString(): string };
  eventType: string;
  actorId?: { toString(): string };
  actorName?: string;
  data: Record<string, unknown>;
  createdAt: Date;
}): CustomerEventDto {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    eventType: doc.eventType,
    actorId: doc.actorId?.toString(),
    actorName: doc.actorName,
    data: doc.data ?? {},
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function appendCustomerEvent(
  customerId: string,
  eventType: string,
  data: Record<string, unknown>,
  actor?: Actor,
): Promise<void> {
  await CustomerEvent.create({
    customerId,
    eventType,
    data,
    actorId: actor?.id,
    actorName: actor?.name,
  });
}

export async function resolveLiveCustomer(id: string): Promise<ICustomer> {
  let currentId = id;
  const seen = new Set<string>();
  while (true) {
    const doc = await Customer.findById(currentId);
    if (!doc) throw new CustomerError('NOT_FOUND', 'Customer not found');
    if (!doc.mergedIntoId) return doc;
    const nextId = doc.mergedIntoId.toString();
    if (seen.has(currentId)) return doc;
    seen.add(currentId);
    currentId = nextId;
  }
}

function identityFromInput(input: { phone: string; phoneCountry?: string; email?: string }) {
  const phone = normalizePhone(input.phone, input.phoneCountry);
  const emailNormalized = normalizeEmail(input.email);
  return {
    phoneCountry: phone.phoneCountry,
    phoneDialCode: phone.dialCode,
    phone: phone.e164,
    phoneNormalized: phone.digits,
    email: emailNormalized,
    emailNormalized,
  };
}

async function loadMatchCandidates(identity: {
  phoneNormalized: string;
  emailNormalized?: string;
}): Promise<MatchCandidate[]> {
  const or: Record<string, unknown>[] = [{ phoneNormalized: identity.phoneNormalized }];
  if (identity.emailNormalized) {
    or.push({ emailNormalized: identity.emailNormalized });
  }
  const docs = await Customer.find({ $or: or });
  return docs.map((d) => ({
    id: d._id.toString(),
    phoneNormalized: d.phoneNormalized,
    emailNormalized: d.emailNormalized,
    mergedIntoId: d.mergedIntoId?.toString(),
  }));
}

export async function matchCustomers(input: {
  phone: string;
  phoneCountry?: string;
  email?: string;
}): Promise<{ decision: ReturnType<typeof decideMatch>; matches: CustomerMatch[] }> {
  const identity = identityFromInput(input);
  const candidates = await loadMatchCandidates(identity);
  const decision = decideMatch(
    {
      phoneNormalized: identity.phoneNormalized,
      emailNormalized: identity.emailNormalized,
    },
    candidates,
  );
  const ids =
    decision.kind === 'exact'
      ? [decision.match.customerId]
      : decision.kind === 'ambiguous'
        ? decision.matches.map((m) => m.customerId)
        : [];
  const docs = await Customer.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  const scored =
    decision.kind === 'exact'
      ? [decision.match]
      : decision.kind === 'ambiguous'
        ? decision.matches
        : [];
  const matches: CustomerMatch[] = scored
    .map((s) => {
      const doc = byId.get(s.customerId);
      if (!doc) return null;
      return { customer: toDto(doc), score: s.score, reasons: s.reasons };
    })
    .filter((m): m is CustomerMatch => m !== null);
  return { decision, matches };
}

export async function createCustomer(
  input: {
    businessName: string;
    contactName: string;
    phone: string;
    phoneCountry?: string;
    country?: string;
    email?: string;
    preferredLanguage?: string;
    location?: CustomerLocation;
    tags?: string[];
    needsReview?: boolean;
    forceCreate?: boolean;
  },
  actor?: Actor,
): Promise<CustomerDto> {
  const identity = identityFromInput(input);
  if (!input.forceCreate) {
    const { decision, matches } = await matchCustomers(input);
    if (decision.kind === 'exact' || decision.kind === 'ambiguous') {
      throw new CustomerError(
        decision.kind === 'ambiguous' ? 'AMBIGUOUS_MATCH' : 'DUPLICATE_CUSTOMER',
        decision.kind === 'ambiguous'
          ? 'Multiple customers match this phone or email. Choose one or force create.'
          : 'A customer with this phone or email already exists.',
        { matches },
      );
    }
  }

  try {
    const doc = await Customer.create({
      customerNumber: await nextCustomerNumber(),
      businessName: input.businessName.trim(),
      contactName: input.contactName.trim(),
      country: normalizeCountry(input.country),
      phoneCountry: identity.phoneCountry,
      phoneDialCode: identity.phoneDialCode,
      phone: identity.phone,
      phoneNormalized: identity.phoneNormalized,
      email: identity.email,
      emailNormalized: identity.emailNormalized,
      preferredLanguage: input.preferredLanguage ?? 'en',
      location: input.location ?? {},
      tags: input.tags ?? [],
      needsReview: Boolean(input.needsReview),
      stats: { totalEnquiries: 0, openEnquiries: 0 },
    });
    await appendCustomerEvent(
      doc._id.toString(),
      'created',
      { needsReview: doc.needsReview },
      actor,
    );
    if (doc.needsReview) {
      await appendCustomerEvent(doc._id.toString(), 'needs_review', { source: 'create' }, actor);
    }
    return toDto(doc);
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      throw new CustomerError('VALIDATION_ERROR', err.message);
    }
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      throw new CustomerError(
        'DUPLICATE_CUSTOMER',
        'A customer with this phone or email already exists.',
      );
    }
    throw err;
  }
}

export async function resolveOrCreateCustomer(
  input: {
    customerId?: string;
    businessName: string;
    contactName: string;
    phone: string;
    phoneCountry?: string;
    country?: string;
    email?: string;
    preferredLanguage?: string;
    forceCreate?: boolean;
    publicSubmit?: boolean;
  },
  actor?: Actor,
): Promise<{ customer: CustomerDto; needsReview: boolean; linkedExisting: boolean }> {
  if (input.customerId) {
    const live = await resolveLiveCustomer(input.customerId);
    const identity = identityFromInput(input);
    if (
      live.phoneNormalized !== identity.phoneNormalized ||
      (identity.emailNormalized &&
        live.emailNormalized &&
        live.emailNormalized !== identity.emailNormalized)
    ) {
      const otherPhone = await Customer.findOne({
        _id: { $ne: live._id },
        phoneNormalized: identity.phoneNormalized,
        mergedIntoId: { $exists: false },
      });
      const otherEmail =
        identity.emailNormalized &&
        (await Customer.findOne({
          _id: { $ne: live._id },
          emailNormalized: identity.emailNormalized,
          mergedIntoId: { $exists: false },
        }));
      if (otherPhone || otherEmail) {
        throw new CustomerError(
          'IDENTITY_CONFLICT',
          'Posted phone or email belongs to a different customer.',
        );
      }
    }
    return { customer: toDto(live), needsReview: live.needsReview, linkedExisting: true };
  }

  const { decision, matches } = await matchCustomers(input);

  if (input.publicSubmit) {
    if (decision.kind === 'exact') {
      const live = await resolveLiveCustomer(decision.match.customerId);
      return { customer: toDto(live), needsReview: false, linkedExisting: true };
    }
    const needsReview = decision.kind === 'ambiguous';
    const customer = await createCustomer(
      { ...input, needsReview, forceCreate: true },
      actor,
    );
    return { customer, needsReview, linkedExisting: false };
  }

  if (decision.kind === 'exact') {
    const live = await resolveLiveCustomer(decision.match.customerId);
    return { customer: toDto(live), needsReview: false, linkedExisting: true };
  }
  if (decision.kind === 'ambiguous' && !input.forceCreate) {
    throw new CustomerError(
      'AMBIGUOUS_MATCH',
      'Multiple customers match this phone or email. Choose a customer or force create.',
      { matches },
    );
  }
  const customer = await createCustomer({ ...input, forceCreate: true }, actor);
  return { customer, needsReview: false, linkedExisting: false };
}

export async function listCustomers(query: {
  q?: string;
  needsReview?: boolean;
  page?: number;
  limit?: number;
}): Promise<CustomerListResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = { mergedIntoId: { $exists: false } };
  if (query.needsReview === true) filter.needsReview = true;
  if (query.q?.trim()) {
    const q = query.q.trim();
    filter.$or = [
      { customerNumber: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { businessName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { contactName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { phone: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { emailNormalized: q.toLowerCase() },
    ];
  }
  const [items, total] = await Promise.all([
    Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Customer.countDocuments(filter),
  ]);
  return { items: items.map(toDto), total };
}

export async function getCustomer(id: string): Promise<CustomerDetailDto> {
  const doc = await resolveLiveCustomer(id);
  const [events, enquiries] = await Promise.all([
    CustomerEvent.find({ customerId: doc._id }).sort({ createdAt: 1 }),
    Enquiry.find({ customerId: doc._id, isArchived: false }).sort({ createdAt: -1 }).limit(20),
  ]);
  return {
    ...toDto(doc),
    timeline: events.map(toEventDto),
    recentEnquiries: enquiries.map((e) => ({
      id: e._id.toString(),
      enquiryNumber: e.enquiryNumber,
      customerId: e.customerId.toString(),
      source: e.source,
      statusId: e.statusId.toString(),
      priorityId: e.priorityId.toString(),
      assignedUserId: e.assignedUserId?.toString(),
      contactName: e.contactName,
      company: e.company,
      country: e.country,
      phoneCountry: e.phoneCountry || e.country,
      phoneDialCode: e.phoneDialCode || '',
      phone: e.phone,
      phoneNormalized: e.phoneNormalized,
      email: e.email,
      emailNormalized: e.emailNormalized,
      message: e.message,
      interestedBookIds: e.interestedBookIds.map((x) => x.toString()),
      interestedCategoryIds: e.interestedCategoryIds.map((x) => x.toString()),
      requirementText: e.requirementText,
      subject: e.subject,
      nextFollowUpAt: e.nextFollowUpAt?.toISOString(),
      needsReview: e.needsReview,
      tags: e.tags,
      isArchived: e.isArchived,
      closedAt: e.closedAt?.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
  };
}

export async function updateCustomer(
  id: string,
  input: Partial<{
    businessName: string;
    contactName: string;
    phone: string;
    phoneCountry?: string;
    country: string;
    email: string;
    preferredLanguage: string;
    location: CustomerLocation;
    tags: string[];
    needsReview: boolean;
  }>,
  actor?: Actor,
): Promise<CustomerDto> {
  const doc = await resolveLiveCustomer(id);
  const before = {
    businessName: doc.businessName,
    contactName: doc.contactName,
    phone: doc.phone,
    email: doc.email,
    needsReview: doc.needsReview,
  };
  if (input.country !== undefined) {
    doc.country = normalizeCountry(input.country);
  }
  if (input.phone !== undefined || input.phoneCountry !== undefined) {
    const identity = identityFromInput({
      phone: input.phone ?? doc.phone,
      phoneCountry: input.phoneCountry ?? doc.phoneCountry ?? doc.country,
      email: input.email ?? doc.email,
    });
    doc.phoneCountry = identity.phoneCountry;
    doc.phoneDialCode = identity.phoneDialCode;
    doc.phone = identity.phone;
    doc.phoneNormalized = identity.phoneNormalized;
    if (input.email !== undefined) {
      doc.email = identity.email;
      doc.emailNormalized = identity.emailNormalized;
    }
  } else if (input.email !== undefined) {
    const emailNormalized = normalizeEmail(input.email);
    doc.email = emailNormalized;
    doc.emailNormalized = emailNormalized;
  }
  if (input.businessName !== undefined) doc.businessName = input.businessName.trim();
  if (input.contactName !== undefined) doc.contactName = input.contactName.trim();
  if (input.preferredLanguage !== undefined) doc.preferredLanguage = input.preferredLanguage;
  if (input.location !== undefined) doc.location = input.location;
  if (input.tags !== undefined) doc.tags = input.tags;
  if (input.needsReview !== undefined) doc.needsReview = input.needsReview;
  try {
    await doc.save();
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      throw new CustomerError(
        'DUPLICATE_CUSTOMER',
        'A customer with this phone or email already exists.',
      );
    }
    throw err;
  }
  await appendCustomerEvent(doc._id.toString(), 'updated', { before }, actor);
  return toDto(doc);
}

export async function archiveCustomer(id: string, actor?: Actor): Promise<CustomerDto> {
  const doc = await resolveLiveCustomer(id);
  doc.isArchived = true;
  await doc.save();
  await appendCustomerEvent(doc._id.toString(), 'archived', {}, actor);
  return toDto(doc);
}

export async function mergeCustomers(
  survivorId: string,
  sourceCustomerId: string,
  actor?: Actor,
): Promise<CustomerDto> {
  if (survivorId === sourceCustomerId) {
    throw new CustomerError('VALIDATION_ERROR', 'Cannot merge a customer into itself');
  }
  const survivor = await resolveLiveCustomer(survivorId);
  const source = await Customer.findById(sourceCustomerId);
  if (!source) throw new CustomerError('NOT_FOUND', 'Source customer not found');
  if (source.mergedIntoId) {
    throw new CustomerError('VALIDATION_ERROR', 'Source customer is already merged');
  }

  const sourceId = source._id;
  await Enquiry.updateMany({ customerId: sourceId }, { $set: { customerId: survivor._id } });
  const moved = await Enquiry.find({ customerId: survivor._id });
  for (const enquiry of moved) {
    await EnquiryEvent.create({
      enquiryId: enquiry._id,
      eventType: 'customer_linked',
      actorId: actor?.id,
      actorName: actor?.name,
      data: { fromCustomerId: sourceId.toString(), toCustomerId: survivor._id.toString() },
    });
  }

  source.mergedIntoId = survivor._id;
  source.isArchived = true;
  await source.save();

  const open = await Enquiry.countDocuments({
    customerId: survivor._id,
    closedAt: { $exists: false },
    isArchived: false,
  });
  const total = await Enquiry.countDocuments({ customerId: survivor._id });
  survivor.stats = { totalEnquiries: total, openEnquiries: open };
  await survivor.save();

  await appendCustomerEvent(
    source._id.toString(),
    'merged_into',
    { survivorId: survivor._id.toString() },
    actor,
  );
  await appendCustomerEvent(
    survivor._id.toString(),
    'merged_from',
    { sourceId: source._id.toString() },
    actor,
  );
  return toDto(survivor);
}

export async function bumpCustomerEnquiryStats(
  customerId: string,
  delta: { total?: number; open?: number },
): Promise<void> {
  await Customer.updateOne(
    { _id: customerId },
    {
      $inc: {
        'stats.totalEnquiries': delta.total ?? 0,
        'stats.openEnquiries': delta.open ?? 0,
      },
    },
  );
}

export { toDto as toCustomerDto };
export { PhoneError };
