import type {
  BookCommercial,
  BookPhysical,
  BookPriceVisibility,
  BookPublishStatus,
  BookPublishing,
  BookTranslation,
} from './book';

/** Canonical spreadsheet columns for book import/export (UTF-8). */
export const BOOK_IMPORT_COLUMNS = [
  'sku',
  'publishStatus',
  'isFeatured',
  'categorySlugs',
  'title_en',
  'slug_en',
  'author_en',
  'shortDescription_en',
  'detailedDescription_en',
  'title_hi',
  'slug_hi',
  'author_hi',
  'shortDescription_hi',
  'detailedDescription_hi',
  'title_sa',
  'slug_sa',
  'author_sa',
  'shortDescription_sa',
  'detailedDescription_sa',
  'title_ne',
  'slug_ne',
  'author_ne',
  'shortDescription_ne',
  'detailedDescription_ne',
  'pages',
  'isbn',
  'edition',
  'publicationYear',
  'publisher',
  'mrp',
  'wholesalePrice',
  'moq',
  'currency',
  'image1Url',
  'image2Url',
  'image3Url',
] as const;

export type BookImportColumn = (typeof BOOK_IMPORT_COLUMNS)[number];

export const CATEGORY_IMPORT_COLUMNS = [
  'slug',
  'parentSlug',
  'status',
  'isVisible',
  'isFeatured',
  'displayOrder',
  'name_en',
  'shortDescription_en',
  'description_en',
  'name_hi',
  'shortDescription_hi',
  'description_hi',
  'name_sa',
  'shortDescription_sa',
  'description_sa',
  'name_ne',
  'shortDescription_ne',
  'description_ne',
  'seoTitle',
  'seoDescription',
] as const;

export type CategoryImportColumn = (typeof CATEGORY_IMPORT_COLUMNS)[number];

export function emptyBookTemplateRow(): Record<BookImportColumn, string> {
  const row = {} as Record<BookImportColumn, string>;
  for (const col of BOOK_IMPORT_COLUMNS) row[col] = '';
  row.publishStatus = 'draft';
  row.isFeatured = 'false';
  row.currency = 'INR';
  row.moq = '1';
  return row;
}

export function emptyCategoryTemplateRow(): Record<CategoryImportColumn, string> {
  const row = {} as Record<CategoryImportColumn, string>;
  for (const col of CATEGORY_IMPORT_COLUMNS) row[col] = '';
  row.status = 'draft';
  row.isVisible = 'true';
  row.isFeatured = 'false';
  row.displayOrder = '0';
  return row;
}

export interface NormalizedBookRow {
  sku?: string;
  publishStatus: BookPublishStatus;
  isFeatured: boolean;
  categorySlugs: string[];
  translations: BookTranslation[];
  physical: BookPhysical;
  publishing: BookPublishing;
  commercial: BookCommercial;
  imageUrls: string[];
  priceVisibility?: BookPriceVisibility;
}
