export type CmsPublishStatus = 'draft' | 'published' | 'hidden';

export interface CmsPageTranslation {
  languageCode: string;
  title: string;
  body: string;
}

export interface CmsPageDto {
  id: string;
  slug: string;
  status: CmsPublishStatus;
  isVisible: boolean;
  translations: CmsPageTranslation[];
  updatedAt: string;
}

export type HomepageSectionType = 'hero' | 'featured_books' | 'categories' | 'custom_content';

export interface HeroSectionConfig {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export interface CustomContentConfig {
  title?: string;
  body?: string;
}

export interface HomepageSectionDto {
  id: string;
  type: HomepageSectionType;
  sortOrder: number;
  isVisible: boolean;
  publishStatus: 'draft' | 'published';
  config: Record<string, unknown>;
  updatedAt: string;
}

export interface PublicHomepageDto {
  sections: HomepageSectionDto[];
}
