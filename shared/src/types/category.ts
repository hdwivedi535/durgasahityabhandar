export type CategoryStatus = 'draft' | 'published' | 'hidden' | 'archived';

export interface CategoryTranslation {
  languageCode: string;
  name: string;
  shortDescription?: string;
  description?: string;
}

export interface CategorySeo {
  title?: string;
  description?: string;
  keywords?: string[];
  socialTitle?: string;
  socialDescription?: string;
  socialImageMediaId?: string;
  canonicalUrl?: string;
  indexable: boolean;
}

export interface CategoryDto {
  id: string;
  parentId: string | null;
  ancestorIds: string[];
  slug: string;
  status: CategoryStatus;
  isVisible: boolean;
  isFeatured: boolean;
  displayOrder: number;
  imageMediaId?: string;
  iconMediaId?: string;
  translations: CategoryTranslation[];
  seo: CategorySeo;
  bookCount?: number;
  children?: CategoryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode extends CategoryDto {
  children: CategoryTreeNode[];
}

export type CategoryArchiveAction = 'move_books' | 'remove_assignments' | 'cancel';

export interface CategoryArchiveInput {
  action: CategoryArchiveAction;
  targetCategoryId?: string;
}
