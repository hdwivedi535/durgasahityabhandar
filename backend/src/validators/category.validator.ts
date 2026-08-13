import { z } from 'zod';

const translationSchema = z.object({
  languageCode: z.string().min(2).max(5),
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
});

const seoSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string().max(50)).optional(),
  socialTitle: z.string().max(200).optional(),
  socialDescription: z.string().max(500).optional(),
  socialImageMediaId: z.string().optional(),
  canonicalUrl: z.string().url().optional().or(z.literal('')),
  indexable: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  parentId: z.string().nullable().optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  status: z.enum(['draft', 'published', 'hidden', 'archived']).optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  imageMediaId: z.string().optional(),
  iconMediaId: z.string().optional(),
  translations: z.array(translationSchema).min(1),
  seo: seoSchema.optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const reorderCategoriesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      displayOrder: z.number().int(),
      parentId: z.string().nullable().optional(),
    }),
  ),
});

export const moveCategorySchema = z.object({
  parentId: z.string().nullable(),
  displayOrder: z.number().int().optional(),
});

export const archiveCategorySchema = z.object({
  action: z.enum(['move_books', 'remove_assignments']),
  targetCategoryId: z.string().optional(),
});

export const categoryQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'published', 'hidden', 'archived']).optional(),
  parentId: z.string().optional(),
  lang: z.string().optional(),
});
