import type { CrmConfigDto, CrmConfigKind } from '@dsb/shared';
import { CrmConfig, type ICrmConfig } from '../models/crm-config.model';

export const DEFAULT_ENQUIRY_STATUSES: Array<
  Omit<CrmConfigDto, 'id'> & { kind: 'enquiryStatus' }
> = [
  { kind: 'enquiryStatus', slug: 'new', name: 'New', color: '#64748b', displayOrder: 0, isActive: true, isPublic: true, isTerminal: false },
  { kind: 'enquiryStatus', slug: 'contacted', name: 'Contacted', color: '#2563eb', displayOrder: 1, isActive: true, isPublic: true, isTerminal: false },
  { kind: 'enquiryStatus', slug: 'follow-up-required', name: 'Follow-up Required', color: '#d97706', displayOrder: 2, isActive: true, isPublic: false, isTerminal: false },
  { kind: 'enquiryStatus', slug: 'quotation-sent', name: 'Quotation Sent', color: '#7c3aed', displayOrder: 3, isActive: true, isPublic: true, isTerminal: false },
  { kind: 'enquiryStatus', slug: 'negotiation', name: 'Negotiation', color: '#0891b2', displayOrder: 4, isActive: true, isPublic: false, isTerminal: false },
  { kind: 'enquiryStatus', slug: 'won', name: 'Won', color: '#16a34a', displayOrder: 5, isActive: true, isPublic: true, isTerminal: true },
  { kind: 'enquiryStatus', slug: 'lost', name: 'Lost', color: '#dc2626', displayOrder: 6, isActive: true, isPublic: true, isTerminal: true },
  { kind: 'enquiryStatus', slug: 'closed', name: 'Closed', color: '#334155', displayOrder: 7, isActive: true, isPublic: true, isTerminal: true },
];

export const DEFAULT_ENQUIRY_PRIORITIES: Array<
  Omit<CrmConfigDto, 'id'> & { kind: 'enquiryPriority' }
> = [
  { kind: 'enquiryPriority', slug: 'low', name: 'Low', color: '#94a3b8', displayOrder: 0, isActive: true, isPublic: false, isTerminal: false },
  { kind: 'enquiryPriority', slug: 'normal', name: 'Normal', color: '#64748b', displayOrder: 1, isActive: true, isPublic: false, isTerminal: false },
  { kind: 'enquiryPriority', slug: 'high', name: 'High', color: '#dc2626', displayOrder: 2, isActive: true, isPublic: false, isTerminal: false },
];

function toDto(doc: ICrmConfig): CrmConfigDto {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    slug: doc.slug,
    name: doc.name,
    color: doc.color,
    displayOrder: doc.displayOrder,
    isActive: doc.isActive,
    isPublic: doc.isPublic,
    isTerminal: doc.isTerminal,
    publicLabel: doc.publicLabel,
  };
}

export async function ensureCrmConfig(): Promise<void> {
  for (const row of [...DEFAULT_ENQUIRY_STATUSES, ...DEFAULT_ENQUIRY_PRIORITIES]) {
    await CrmConfig.findOneAndUpdate(
      { kind: row.kind, slug: row.slug },
      { $setOnInsert: row },
      { upsert: true },
    );
  }
}

export async function listCrmConfig(kind?: CrmConfigKind): Promise<CrmConfigDto[]> {
  await ensureCrmConfig();
  const query: Record<string, unknown> = {};
  if (kind) query.kind = kind;
  const docs = await CrmConfig.find(query).sort({ kind: 1, displayOrder: 1 });
  return docs.map(toDto);
}

export async function getStatusBySlug(slug: string): Promise<CrmConfigDto> {
  await ensureCrmConfig();
  const doc = await CrmConfig.findOne({ kind: 'enquiryStatus', slug });
  if (!doc) throw new Error(`Missing enquiry status: ${slug}`);
  return toDto(doc);
}

export async function getPriorityBySlug(slug: string): Promise<CrmConfigDto> {
  await ensureCrmConfig();
  const doc = await CrmConfig.findOne({ kind: 'enquiryPriority', slug });
  if (!doc) throw new Error(`Missing enquiry priority: ${slug}`);
  return toDto(doc);
}

export async function getCrmConfigById(id: string): Promise<CrmConfigDto | null> {
  const doc = await CrmConfig.findById(id);
  return doc ? toDto(doc) : null;
}
