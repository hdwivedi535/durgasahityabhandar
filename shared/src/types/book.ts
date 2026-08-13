export type BookPublishStatus = 'draft' | 'preview' | 'published' | 'archived';

export interface BookPhysical {
  pages?: number;
  pageTypeId?: string;
  gsm?: number;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  bindingTypeId?: string;
}

export interface BookPublishing {
  isbn?: string;
  edition?: string;
  publicationYear?: number;
  publisher?: string;
}

export interface BookCommercial {
  mrp?: number;
  wholesalePrice?: number;
  moq?: number;
  currency?: string;
}

export interface BookFieldVisibility {
  physical?: boolean;
  publishing?: boolean;
  commercial?: boolean;
  author?: boolean;
  translator?: boolean;
}

export interface BookPriceVisibility {
  showMrp?: boolean;
  showWholesale?: boolean;
  showMoq?: boolean;
}

export interface BookSeo {
  title?: string;
  description?: string;
  keywords?: string[];
  indexable?: boolean;
}

export interface BookTranslation {
  languageCode: string;
  title: string;
  slug: string;
  author?: string;
  translator?: string;
  commentator?: string;
  shortDescription?: string;
  detailedDescription?: string;
  contentHighlights?: string[];
  seo?: BookSeo;
}

export interface BookDto {
  id: string;
  sku?: string;
  categoryIds: string[];
  subjectIds: string[];
  tagIds: string[];
  languageId?: string;
  availabilityId?: string;
  physical: BookPhysical;
  publishing: BookPublishing;
  commercial: BookCommercial;
  fieldVisibility: BookFieldVisibility;
  priceVisibility: BookPriceVisibility;
  /** Ordered image URLs (max 3). Index 0 = primary/cover. */
  imageUrls: string[];
  coverMediaId?: string;
  galleryMediaIds: string[];
  isFeatured: boolean;
  publishStatus: BookPublishStatus;
  publishedAt?: string;
  translations: BookTranslation[];
  createdAt: string;
  updatedAt: string;
}

export interface BookListResult {
  items: BookDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PublicBookListResult {
  items: PublicBookDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PublicBookDto extends BookDto {
  displayTitle: string;
  displaySlug: string;
  displayAuthor?: string;
}

export type ImportRowAction = 'create' | 'update' | 'skip' | 'error';

export interface ImportRowError {
  field: string;
  message: string;
}

export interface BookImportRowPreview {
  rowNumber: number;
  action: ImportRowAction;
  sku?: string;
  title?: string;
  slug?: string;
  existingBookId?: string;
  errors: ImportRowError[];
  warnings: string[];
  imageStatus: Array<{ url: string; ok: boolean; message?: string }>;
  payload?: BookImportPayload;
}

export interface BookImportPayload {
  sku?: string;
  categorySlugs: string[];
  categoryIds: string[];
  publishStatus: BookPublishStatus;
  isFeatured: boolean;
  physical: BookPhysical;
  publishing: BookPublishing;
  commercial: BookCommercial;
  imageUrls: string[];
  translations: BookTranslation[];
  existingBookId?: string;
}

export interface ImportPreviewSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  creates: number;
  updates: number;
}

export interface BookImportPreviewResult {
  summary: ImportPreviewSummary;
  rows: BookImportRowPreview[];
}

export interface BookImportConfirmResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

export interface CategoryImportPayload {
  slug: string;
  parentSlug?: string | null;
  status: 'draft' | 'published' | 'hidden' | 'archived';
  isVisible: boolean;
  isFeatured: boolean;
  displayOrder?: number;
  translations: Array<{
    languageCode: string;
    name: string;
    shortDescription?: string;
    description?: string;
  }>;
  seo?: {
    title?: string;
    description?: string;
  };
  existingCategoryId?: string;
}

export interface CategoryImportRowPreview {
  rowNumber: number;
  action: ImportRowAction;
  slug?: string;
  name?: string;
  parentSlug?: string | null;
  existingCategoryId?: string;
  errors: ImportRowError[];
  warnings: string[];
  payload?: CategoryImportPayload;
}

export interface CategoryImportPreviewResult {
  summary: ImportPreviewSummary;
  rows: CategoryImportRowPreview[];
}

export interface CategoryImportConfirmResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ rowNumber: number; message: string }>;
}
