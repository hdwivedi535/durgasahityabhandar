import type {
  CrmConfigDto,
  EnquiryDashboardCounts,
  EnquiryDetailDto,
  EnquiryDto,
  EnquiryEventDto,
  EnquiryListResult,
  EnquiryMessageDto,
  EnquiryMessageType,
  LeadScoreDto,
  TimelineItem,
  UserOptionDto,
} from '@dsb/shared';
import mongoose from 'mongoose';
import { Enquiry, type IEnquiry } from '../models/enquiry.model';
import { EnquiryEvent } from '../models/enquiry-event.model';
import { EnquiryMessage } from '../models/enquiry-message.model';
import { User } from '../models/user.model';
import { CrmConfig } from '../models/crm-config.model';
import {
  CustomerError,
  appendCustomerEvent,
  bumpCustomerEnquiryStats,
  resolveOrCreateCustomer,
  toCustomerDto,
  type Actor,
} from './customer.service';
import { Customer } from '../models/customer.model';
import {
  ensureCrmConfig,
  getCrmConfigById,
  getPriorityBySlug,
  getStatusBySlug,
} from './crm-config.service';
import { nextEnquiryNumber } from '../utils/sequence';
import { normalizeEmail, normalizePhone } from '../utils/phone';
import { assignLeadScore, buildLeadScoreForEnquiry, toLeadScoreDto } from './lead-score.service';

export class EnquiryError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function oid(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new EnquiryError('VALIDATION_ERROR', 'Invalid id');
  }
  return new mongoose.Types.ObjectId(id);
}

function toMessageDto(doc: {
  _id: { toString(): string };
  enquiryId: { toString(): string };
  type: EnquiryMessageType;
  channel: 'website' | 'crm';
  content: string;
  authorId?: { toString(): string };
  authorName: string;
  createdAt: Date;
}): EnquiryMessageDto {
  return {
    id: doc._id.toString(),
    enquiryId: doc.enquiryId.toString(),
    type: doc.type,
    channel: doc.channel,
    content: doc.content,
    authorId: doc.authorId?.toString(),
    authorName: doc.authorName,
    createdAt: doc.createdAt.toISOString(),
  };
}

function toEventDto(doc: {
  _id: { toString(): string };
  enquiryId: { toString(): string };
  eventType: string;
  actorId?: { toString(): string };
  actorName?: string;
  data: Record<string, unknown>;
  createdAt: Date;
}): EnquiryEventDto {
  return {
    id: doc._id.toString(),
    enquiryId: doc.enquiryId.toString(),
    eventType: doc.eventType,
    actorId: doc.actorId?.toString(),
    actorName: doc.actorName,
    data: doc.data ?? {},
    createdAt: doc.createdAt.toISOString(),
  };
}

async function configMap(ids: string[]): Promise<Map<string, CrmConfigDto>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const docs = await CrmConfig.find({ _id: { $in: unique } });
  return new Map(
    docs.map((d) => [
      d._id.toString(),
      {
        id: d._id.toString(),
        kind: d.kind,
        slug: d.slug,
        name: d.name,
        color: d.color,
        displayOrder: d.displayOrder,
        isActive: d.isActive,
        isPublic: d.isPublic,
        isTerminal: d.isTerminal,
        publicLabel: d.publicLabel,
      },
    ]),
  );
}

async function userNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const docs = await User.find({ _id: { $in: unique } }).select('_id name');
  return new Map(docs.map((d) => [d._id.toString(), d.name]));
}

export async function toEnquiryDto(doc: IEnquiry): Promise<EnquiryDto> {
  const [configs, users] = await Promise.all([
    configMap([doc.statusId.toString(), doc.priorityId.toString()]),
    userNameMap(doc.assignedUserId ? [doc.assignedUserId.toString()] : []),
  ]);
  const assignedUserId = doc.assignedUserId?.toString();
  let leadScore: LeadScoreDto | undefined;
  if (doc.leadScore?.calculatedAt) {
    leadScore = toLeadScoreDto(doc.leadScore);
  } else {
    leadScore = await buildLeadScoreForEnquiry(doc);
  }
  return {
    id: doc._id.toString(),
    enquiryNumber: doc.enquiryNumber,
    customerId: doc.customerId.toString(),
    source: doc.source,
    statusId: doc.statusId.toString(),
    status: configs.get(doc.statusId.toString()),
    priorityId: doc.priorityId.toString(),
    priority: configs.get(doc.priorityId.toString()),
    assignedUserId,
    assignedUserName: assignedUserId ? users.get(assignedUserId) : undefined,
    contactName: doc.contactName,
    company: doc.company,
    country: doc.country,
    phone: doc.phone,
    phoneNormalized: doc.phoneNormalized,
    email: doc.email,
    emailNormalized: doc.emailNormalized,
    message: doc.message,
    interestedBookIds: doc.interestedBookIds.map((x) => x.toString()),
    interestedCategoryIds: doc.interestedCategoryIds.map((x) => x.toString()),
    requirementText: doc.requirementText,
    subject: doc.subject,
    nextFollowUpAt: doc.nextFollowUpAt?.toISOString(),
    needsReview: doc.needsReview,
    tags: doc.tags ?? [],
    isArchived: doc.isArchived,
    closedAt: doc.closedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    leadScore,
  };
}

export interface CreateEnquiryInput {
  customerId?: string;
  forceCreate?: boolean;
  publicSubmit?: boolean;
  source: 'website' | 'manual';
  contactName: string;
  company: string;
  phone: string;
  country?: string;
  email?: string;
  preferredLanguage?: string;
  message: string;
  interestedBookIds?: string[];
  interestedCategoryIds?: string[];
  requirementText?: string;
  subject?: string;
  assignedUserId?: string;
  priorityId?: string;
  nextFollowUpAt?: string;
}

export async function createEnquiry(input: CreateEnquiryInput, actor?: Actor): Promise<EnquiryDto> {
  await ensureCrmConfig();
  let resolved;
  try {
    resolved = await resolveOrCreateCustomer(
      {
        customerId: input.customerId,
        businessName: input.company,
        contactName: input.contactName,
        phone: input.phone,
        country: input.country,
        email: input.email,
        preferredLanguage: input.preferredLanguage,
        forceCreate: input.forceCreate,
        publicSubmit: input.publicSubmit,
      },
      actor,
    );
  } catch (err) {
    if (err instanceof CustomerError) {
      throw new EnquiryError(err.code, err.message, err.details);
    }
    throw err;
  }

  const phone = normalizePhone(input.phone, input.country);
  const emailNormalized = normalizeEmail(input.email);
  const status = await getStatusBySlug('new');
  const priority = input.priorityId
    ? await getCrmConfigById(input.priorityId)
    : await getPriorityBySlug('normal');
  if (!priority || priority.kind !== 'enquiryPriority') {
    throw new EnquiryError('VALIDATION_ERROR', 'Invalid priority');
  }

  const subject =
    input.subject?.trim() ||
    `Enquiry from ${input.company.trim() || input.contactName.trim()}`;

  const doc = await Enquiry.create({
    enquiryNumber: await nextEnquiryNumber(),
    customerId: resolved.customer.id,
    source: input.source,
    statusId: status.id,
    priorityId: priority.id,
    assignedUserId: input.assignedUserId || undefined,
    contactName: input.contactName.trim(),
    company: input.company.trim(),
    country: phone.country,
    phone: phone.e164,
    phoneNormalized: phone.digits,
    email: emailNormalized,
    emailNormalized,
    message: input.message.trim(),
    interestedBookIds: input.interestedBookIds ?? [],
    interestedCategoryIds: input.interestedCategoryIds ?? [],
    requirementText: input.requirementText?.trim(),
    subject,
    nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
    needsReview: resolved.needsReview,
  });

  await EnquiryMessage.create({
    enquiryId: doc._id,
    type: 'customer',
    channel: input.source === 'website' ? 'website' : 'crm',
    content: input.message.trim(),
    authorName: input.contactName.trim(),
  });

  await EnquiryEvent.create({
    enquiryId: doc._id,
    eventType: 'created',
    actorId: actor?.id,
    actorName: actor?.name,
    data: { source: input.source, customerId: resolved.customer.id },
  });

  if (resolved.needsReview) {
    await EnquiryEvent.create({
      enquiryId: doc._id,
      eventType: 'needs_review',
      actorId: actor?.id,
      actorName: actor?.name,
      data: { reason: 'ambiguous_public_match' },
    });
  }

  await appendCustomerEvent(
    resolved.customer.id,
    'enquiry_linked',
    { enquiryId: doc._id.toString(), enquiryNumber: doc.enquiryNumber },
    actor,
  );
  await bumpCustomerEnquiryStats(resolved.customer.id, { total: 1, open: 1 });
  await assignLeadScore(doc);
  await doc.save();

  return toEnquiryDto(doc);
}

export async function listEnquiries(query: {
  q?: string;
  statusId?: string;
  source?: 'website' | 'manual';
  customerId?: string;
  assignedUserId?: string;
  needsReview?: boolean;
  followUpDue?: boolean;
  page?: number;
  limit?: number;
}): Promise<EnquiryListResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = { isArchived: false };
  if (query.statusId) filter.statusId = oid(query.statusId);
  if (query.source) filter.source = query.source;
  if (query.customerId) filter.customerId = oid(query.customerId);
  if (query.assignedUserId === 'unassigned') filter.assignedUserId = { $exists: false };
  else if (query.assignedUserId) filter.assignedUserId = oid(query.assignedUserId);
  if (query.needsReview === true) filter.needsReview = true;
  if (query.followUpDue) {
    filter.nextFollowUpAt = { $lte: new Date() };
  }
  if (query.q?.trim()) {
    const raw = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(raw, 'i');
    filter.$or = [
      { enquiryNumber: re },
      { subject: re },
      { contactName: re },
      { company: re },
      { phone: re },
      { emailNormalized: query.q.trim().toLowerCase() },
    ];
  }
  const [items, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Enquiry.countDocuments(filter),
  ]);
  const dtos = await Promise.all(items.map((d) => toEnquiryDto(d)));
  return { items: dtos, total };
}

export async function getEnquiry(id: string): Promise<EnquiryDetailDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  const [dto, messages, events, customer] = await Promise.all([
    toEnquiryDto(doc),
    EnquiryMessage.find({ enquiryId: doc._id }).sort({ createdAt: 1 }),
    EnquiryEvent.find({ enquiryId: doc._id }).sort({ createdAt: 1 }),
    Customer.findById(doc.customerId),
  ]);
  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ kind: 'message' as const, item: toMessageDto(m) })),
    ...events.map((e) => ({ kind: 'event' as const, item: toEventDto(e) })),
  ].sort((a, b) => a.item.createdAt.localeCompare(b.item.createdAt));
  return {
    ...dto,
    customer: customer ? toCustomerDto(customer) : undefined,
    timeline,
  };
}

export async function updateEnquiry(
  id: string,
  input: Partial<{
    subject: string;
    interestedBookIds: string[];
    interestedCategoryIds: string[];
    requirementText: string;
    tags: string[];
    message: string;
  }>,
  actor?: Actor,
): Promise<EnquiryDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  if (input.subject !== undefined) doc.subject = input.subject.trim();
  if (input.interestedBookIds !== undefined) doc.interestedBookIds = input.interestedBookIds.map(oid);
  if (input.interestedCategoryIds !== undefined) {
    doc.interestedCategoryIds = input.interestedCategoryIds.map(oid);
  }
  if (input.requirementText !== undefined) doc.requirementText = input.requirementText.trim();
  if (input.tags !== undefined) doc.tags = input.tags;
  await assignLeadScore(doc);
  await doc.save();
  await EnquiryEvent.create({
    enquiryId: doc._id,
    eventType: 'updated',
    actorId: actor?.id,
    actorName: actor?.name,
    data: { fields: Object.keys(input) },
  });
  return toEnquiryDto(doc);
}

export async function changeEnquiryStatus(
  id: string,
  statusId: string,
  actor?: Actor,
): Promise<EnquiryDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  const status = await getCrmConfigById(statusId);
  if (!status || status.kind !== 'enquiryStatus') {
    throw new EnquiryError('VALIDATION_ERROR', 'Invalid status');
  }
  const previous = doc.statusId.toString();
  const previousCfg = await getCrmConfigById(previous);
  doc.statusId = oid(statusId);
  if (status.isTerminal) {
    doc.closedAt = new Date();
  } else {
    doc.closedAt = undefined;
  }
  await assignLeadScore(doc);
  await doc.save();
  await EnquiryEvent.create({
    enquiryId: doc._id,
    eventType: 'status_changed',
    actorId: actor?.id,
    actorName: actor?.name,
    data: { from: previous, to: statusId, slug: status.slug },
  });
  if (previousCfg?.isTerminal && !status.isTerminal) {
    await bumpCustomerEnquiryStats(doc.customerId.toString(), { open: 1 });
  } else if (!previousCfg?.isTerminal && status.isTerminal) {
    await bumpCustomerEnquiryStats(doc.customerId.toString(), { open: -1 });
  }
  return toEnquiryDto(doc);
}

export async function changeEnquiryPriority(
  id: string,
  priorityId: string,
  actor?: Actor,
): Promise<EnquiryDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  const priority = await getCrmConfigById(priorityId);
  if (!priority || priority.kind !== 'enquiryPriority') {
    throw new EnquiryError('VALIDATION_ERROR', 'Invalid priority');
  }
  const previous = doc.priorityId.toString();
  doc.priorityId = oid(priorityId);
  await doc.save();
  await EnquiryEvent.create({
    enquiryId: doc._id,
    eventType: 'priority_changed',
    actorId: actor?.id,
    actorName: actor?.name,
    data: { from: previous, to: priorityId },
  });
  return toEnquiryDto(doc);
}

export async function assignEnquiry(
  id: string,
  userId: string | null,
  actor?: Actor,
): Promise<EnquiryDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  if (userId) {
    const user = await User.findById(userId);
    if (!user || user.status !== 'active') {
      throw new EnquiryError('VALIDATION_ERROR', 'Assignee must be an active user');
    }
    doc.assignedUserId = oid(userId);
  } else {
    doc.assignedUserId = undefined;
  }
  await assignLeadScore(doc);
  await doc.save();
  await EnquiryEvent.create({
    enquiryId: doc._id,
    eventType: 'assigned',
    actorId: actor?.id,
    actorName: actor?.name,
    data: { userId },
  });
  return toEnquiryDto(doc);
}

export async function setFollowUp(
  id: string,
  nextFollowUpAt: string | null,
  actor?: Actor,
): Promise<EnquiryDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  doc.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : undefined;
  await assignLeadScore(doc);
  await doc.save();
  await EnquiryEvent.create({
    enquiryId: doc._id,
    eventType: 'follow_up_set',
    actorId: actor?.id,
    actorName: actor?.name,
    data: { nextFollowUpAt },
  });
  return toEnquiryDto(doc);
}

export async function addEnquiryMessage(
  id: string,
  input: { type: 'agent' | 'internal_note'; content: string },
  actor: Actor,
): Promise<EnquiryMessageDto> {
  const doc = await Enquiry.findById(id);
  if (!doc) throw new EnquiryError('NOT_FOUND', 'Enquiry not found');
  const content = input.content.trim();
  if (!content) throw new EnquiryError('VALIDATION_ERROR', 'Message is required');
  const message = await EnquiryMessage.create({
    enquiryId: doc._id,
    type: input.type,
    channel: 'crm',
    content,
    authorId: actor.id,
    authorName: actor.name ?? 'Agent',
  });
  return toMessageDto(message);
}

export async function listAssignOptions(): Promise<UserOptionDto[]> {
  const users = await User.find({ status: 'active' }).select('_id name').sort({ name: 1 });
  return users.map((u) => ({ id: u._id.toString(), name: u.name }));
}

export async function getDashboardCounts(): Promise<EnquiryDashboardCounts> {
  await ensureCrmConfig();
  const statuses = await CrmConfig.find({ kind: 'enquiryStatus', isActive: true }).sort({
    displayOrder: 1,
  });
  const counts = await Enquiry.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { isArchived: false } },
    { $group: { _id: '$statusId', count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [c._id.toString(), c.count]));
  const [unassigned, needsReview, followUpsDue] = await Promise.all([
    Enquiry.countDocuments({ isArchived: false, assignedUserId: { $exists: false } }),
    Enquiry.countDocuments({ isArchived: false, needsReview: true }),
    Enquiry.countDocuments({
      isArchived: false,
      nextFollowUpAt: { $lte: new Date() },
      closedAt: { $exists: false },
    }),
  ]);
  return {
    byStatus: statuses.map((s) => ({
      statusId: s._id.toString(),
      slug: s.slug,
      name: s.name,
      count: byId.get(s._id.toString()) ?? 0,
    })),
    unassigned,
    needsReview,
    followUpsDue,
  };
}
