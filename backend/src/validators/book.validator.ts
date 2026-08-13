import { z } from 'zod';

const seoSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string().max(50)).optional(),
  indexable: z.boolean().optional(),
});

const translationSchema = z.object({
  languageCode: z.string().min(2).max(5),
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  author: z.string().max(200).optional(),
  translator: z.string().max(200).optional(),
  commentator: z.string().max(200).optional(),
  shortDescription: z.string().max(1000).optional(),
  detailedDescription: z.string().max(20000).optional(),
  contentHighlights: z.array(z.string().max(300)).optional(),
  seo: seoSchema.optional(),
});

const physicalSchema = z.object({
  pages: z.number().int().positive().optional(),
  pageTypeId: z.string().optional(),
  gsm: z.number().int().positive().optional(),
  weightGrams: z.number().positive().optional(),
  lengthMm: z.number().positive().optional(),
  widthMm: z.number().positive().optional(),
  heightMm: z.number().positive().optional(),
  bindingTypeId: z.string().optional(),
});

const publishingSchema = z.object({
  isbn: z.string().max(20).optional(),
  edition: z.string().max(100).optional(),
  publicationYear: z.number().int().min(1000).max(2100).optional(),
  publisher: z.string().max(200).optional(),
});

const commercialSchema = z.object({
  mrp: z.number().nonnegative().optional(),
  wholesalePrice: z.number().nonnegative().optional(),
  moq: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
});

const fieldVisibilitySchema = z.object({
  physical: z.boolean().optional(),
  publishing: z.boolean().optional(),
  commercial: z.boolean().optional(),
  author: z.boolean().optional(),
  translator: z.boolean().optional(),
});

const priceVisibilitySchema = z.object({
  showMrp: z.boolean().optional(),
  showWholesale: z.boolean().optional(),
  showMoq: z.boolean().optional(),
});

export const createBookSchema = z.object({
  sku: z.string().max(50).optional(),
  categoryIds: z.array(z.string()).default([]),
  subjectIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  languageId: z.string().optional(),
  availabilityId: z.string().optional(),
  physical: physicalSchema.optional(),
  publishing: publishingSchema.optional(),
  commercial: commercialSchema.optional(),
  fieldVisibility: fieldVisibilitySchema.optional(),
  priceVisibility: priceVisibilitySchema.optional(),
  coverMediaId: z.string().optional(),
  galleryMediaIds: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  publishStatus: z.enum(['draft', 'preview', 'published', 'archived']).optional(),
  translations: z.array(translationSchema).min(1),
});

export const updateBookSchema = createBookSchema.partial();

export const bookQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'preview', 'published', 'archived']).optional(),
  categoryId: z.string().optional(),
  featured: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  lang: z.string().optional(),
});

export const publicBookQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  featured: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  lang: z.string().optional(),
});
