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
