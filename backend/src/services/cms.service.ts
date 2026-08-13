import type {
  CmsPageDto,
  CmsPageTranslation,
  CmsPublishStatus,
  HomepageSectionDto,
  HomepageSectionType,
  PublicHomepageDto,
} from '@dsb/shared';
import { CmsPage, type ICmsPage } from '../models/cms-page.model';
import { HomepageSection, type IHomepageSection } from '../models/homepage-section.model';

export class CmsError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function pageToDto(doc: ICmsPage): CmsPageDto {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    status: doc.status,
    isVisible: doc.isVisible,
    translations: doc.translations,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function sectionToDto(doc: IHomepageSection): HomepageSectionDto {
  return {
    id: doc._id.toString(),
    type: doc.type,
    sortOrder: doc.sortOrder,
    isVisible: doc.isVisible,
    publishStatus: doc.publishStatus,
    config: (doc.config ?? {}) as Record<string, unknown>,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

const DEFAULT_PAGES: Array<{
  slug: string;
  translations: CmsPageTranslation[];
}> = [
  {
    slug: 'about',
    translations: [
      {
        languageCode: 'en',
        title: 'About',
        body:
          'Durga Sahitya Bhandar publishes and distributes Hindu religious books for institutions, distributors, and booksellers.\n\nThis is a B2B catalogue and enquiry platform — there is no online checkout.',
      },
    ],
  },
  {
    slug: 'wholesale',
    translations: [
      {
        languageCode: 'en',
        title: 'Wholesale',
        body:
          'We supply religious books to institutions, distributors, and booksellers. Pricing and fulfilment are handled through enquiry.\n\n1. Browse the catalogue and note titles or SKUs.\n2. Send an enquiry with quantities and delivery location.\n3. Our team confirms availability, wholesale rates, MOQ, and dispatch.',
      },
    ],
  },
  {
    slug: 'contact',
    translations: [
      {
        languageCode: 'en',
        title: 'Contact',
        body:
          'For catalogue, wholesale, or dispatch questions, send an enquiry so our team can respond with the right titles and quantities.\n\nPublisher: Durga Sahitya Bhandar\nHours: Monday–Saturday, business hours (IST)',
      },
    ],
  },
];

const DEFAULT_SECTIONS: Array<{
  type: HomepageSectionType;
  sortOrder: number;
  config: Record<string, unknown>;
}> = [
  {
    type: 'hero',
    sortOrder: 0,
    config: {
      eyebrow: 'B2B Publishing',
      headline: 'Religious books for institutions, distributors & booksellers',
      subhead:
        'Browse our catalogue, submit wholesale enquiries, and track your requests — all in one professional platform.',
      ctaLabel: 'Browse Catalogue',
      ctaHref: '/books',
      secondaryCtaLabel: 'Submit Enquiry',
      secondaryCtaHref: '/enquiry',
    },
  },
  { type: 'featured_books', sortOrder: 1, config: { displayCount: 8 } },
  { type: 'categories', sortOrder: 2, config: {} },
];

export async function ensureCmsDefaults(): Promise<void> {
  if ((await CmsPage.countDocuments()) === 0) {
    await CmsPage.insertMany(
      DEFAULT_PAGES.map((p) => ({
        ...p,
        status: 'published' as const,
        isVisible: true,
      })),
    );
  }
  if ((await HomepageSection.countDocuments()) === 0) {
    await HomepageSection.insertMany(
      DEFAULT_SECTIONS.map((s) => ({
        ...s,
        isVisible: true,
        publishStatus: 'published' as const,
      })),
    );
  }
}

export async function listCmsPages(): Promise<CmsPageDto[]> {
  await ensureCmsDefaults();
  const docs = await CmsPage.find().sort({ slug: 1 });
  return docs.map(pageToDto);
}

export async function getPublicCmsPage(slug: string, lang = 'en'): Promise<CmsPageDto | null> {
  await ensureCmsDefaults();
  const doc = await CmsPage.findOne({
    slug: slug.toLowerCase(),
    status: 'published',
    isVisible: true,
  });
  if (!doc) return null;
  const dto = pageToDto(doc);
  const preferred =
    dto.translations.find((t) => t.languageCode === lang) ??
    dto.translations.find((t) => t.languageCode === 'en') ??
    dto.translations[0];
  return { ...dto, translations: preferred ? [preferred, ...dto.translations.filter((t) => t !== preferred)] : dto.translations };
}

export async function updateCmsPage(
  id: string,
  input: Partial<{
    status: CmsPublishStatus;
    isVisible: boolean;
    translations: CmsPageTranslation[];
  }>,
): Promise<CmsPageDto> {
  const doc = await CmsPage.findById(id);
  if (!doc) throw new CmsError('NOT_FOUND', 'Page not found');
  if (input.status !== undefined) doc.status = input.status;
  if (input.isVisible !== undefined) doc.isVisible = input.isVisible;
  if (input.translations) doc.translations = input.translations;
  await doc.save();
  return pageToDto(doc);
}

export async function listHomepageSections(publicOnly = false): Promise<HomepageSectionDto[]> {
  await ensureCmsDefaults();
  const query: Record<string, unknown> = {};
  if (publicOnly) {
    query.isVisible = true;
    query.publishStatus = 'published';
  }
  const docs = await HomepageSection.find(query).sort({ sortOrder: 1 });
  return docs.map(sectionToDto);
}

export async function getPublicHomepage(): Promise<PublicHomepageDto> {
  return { sections: await listHomepageSections(true) };
}

export async function updateHomepageSection(
  id: string,
  input: Partial<{
    isVisible: boolean;
    publishStatus: 'draft' | 'published';
    sortOrder: number;
    config: Record<string, unknown>;
  }>,
): Promise<HomepageSectionDto> {
  const doc = await HomepageSection.findById(id);
  if (!doc) throw new CmsError('NOT_FOUND', 'Section not found');
  if (input.isVisible !== undefined) doc.isVisible = input.isVisible;
  if (input.publishStatus !== undefined) doc.publishStatus = input.publishStatus;
  if (input.sortOrder !== undefined) doc.sortOrder = input.sortOrder;
  if (input.config) doc.config = { ...doc.config, ...input.config };
  await doc.save();
  return sectionToDto(doc);
}

export async function reorderHomepageSections(
  items: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  for (const item of items) {
    await HomepageSection.findByIdAndUpdate(item.id, { sortOrder: item.sortOrder });
  }
}
