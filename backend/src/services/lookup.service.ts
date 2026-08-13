import type { LookupDto, LookupKind } from '@dsb/shared';
import { Lookup, type ILookup } from '../models/lookup.model';

export class LookupError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function toDto(doc: ILookup): LookupDto {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    slug: doc.slug,
    name: doc.name,
    isActive: doc.isActive,
    displayOrder: doc.displayOrder,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listLookups(kind?: LookupKind, activeOnly = false): Promise<LookupDto[]> {
  const query: Record<string, unknown> = {};
  if (kind) query.kind = kind;
  if (activeOnly) query.isActive = true;
  const docs = await Lookup.find(query).sort({ kind: 1, displayOrder: 1, name: 1 });
  return docs.map(toDto);
}

export async function createLookup(input: {
  kind: LookupKind;
  slug: string;
  name: string;
  displayOrder?: number;
}): Promise<LookupDto> {
  const slug = input.slug.toLowerCase().trim();
  const existing = await Lookup.findOne({ kind: input.kind, slug });
  if (existing) throw new LookupError('SLUG_EXISTS', 'Lookup slug already exists for this type');
  const max = await Lookup.findOne({ kind: input.kind }).sort({ displayOrder: -1 });
  const doc = await Lookup.create({
    kind: input.kind,
    slug,
    name: input.name.trim(),
    isActive: true,
    displayOrder: input.displayOrder ?? (max ? max.displayOrder + 1 : 0),
  });
  return toDto(doc);
}

export async function updateLookup(
  id: string,
  input: Partial<{ name: string; slug: string; isActive: boolean; displayOrder: number }>,
): Promise<LookupDto> {
  const doc = await Lookup.findById(id);
  if (!doc) throw new LookupError('NOT_FOUND', 'Lookup not found');
  if (input.slug && input.slug.toLowerCase() !== doc.slug) {
    const existing = await Lookup.findOne({ kind: doc.kind, slug: input.slug.toLowerCase() });
    if (existing) throw new LookupError('SLUG_EXISTS', 'Lookup slug already exists for this type');
    doc.slug = input.slug.toLowerCase();
  }
  if (input.name !== undefined) doc.name = input.name.trim();
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  if (input.displayOrder !== undefined) doc.displayOrder = input.displayOrder;
  await doc.save();
  return toDto(doc);
}

export async function deleteLookup(id: string): Promise<void> {
  const doc = await Lookup.findById(id);
  if (!doc) throw new LookupError('NOT_FOUND', 'Lookup not found');
  await doc.deleteOne();
}

export async function lookupNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const docs = await Lookup.find({ _id: { $in: unique } }).select('_id name');
  return new Map(docs.map((d) => [d._id.toString(), d.name]));
}

const DEFAULT_LOOKUPS: Array<{ kind: LookupKind; slug: string; name: string; displayOrder: number }> = [
  { kind: 'pageType', slug: 'maplitho', name: 'Maplitho', displayOrder: 0 },
  { kind: 'pageType', slug: 'cream-wove', name: 'Cream wove', displayOrder: 1 },
  { kind: 'pageType', slug: 'bible-paper', name: 'Bible paper', displayOrder: 2 },
  { kind: 'bindingType', slug: 'paperback', name: 'Paperback', displayOrder: 0 },
  { kind: 'bindingType', slug: 'hardcover', name: 'Hardcover', displayOrder: 1 },
  { kind: 'bindingType', slug: 'spiral', name: 'Spiral', displayOrder: 2 },
  { kind: 'availability', slug: 'in-stock', name: 'In stock', displayOrder: 0 },
  { kind: 'availability', slug: 'limited', name: 'Limited stock', displayOrder: 1 },
  { kind: 'availability', slug: 'reprint', name: 'Reprint underway', displayOrder: 2 },
  { kind: 'availability', slug: 'out-of-stock', name: 'Out of stock', displayOrder: 3 },
  { kind: 'subject', slug: 'scriptures', name: 'Scriptures', displayOrder: 0 },
  { kind: 'subject', slug: 'puja', name: 'Puja & ritual', displayOrder: 1 },
  { kind: 'tag', slug: 'bestseller', name: 'Bestseller', displayOrder: 0 },
];

export async function ensureDefaultLookups(): Promise<void> {
  const count = await Lookup.countDocuments();
  if (count > 0) return;
  await Lookup.insertMany(DEFAULT_LOOKUPS);
}
