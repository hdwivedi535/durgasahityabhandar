import mongoose from 'mongoose';
import type {
  BookDto,
  BookListResult,
  BookPublishStatus,
  BookTranslation,
  PublicBookDto,
} from '@dsb/shared';
import { Book, type IBook } from '../models/book.model';
import { BookTranslation as BookTranslationModel } from '../models/book-translation.model';

export class BookError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function toObjectId(value?: string): mongoose.Types.ObjectId | undefined {
  if (!value) return undefined;
  return new mongoose.Types.ObjectId(value);
}

function toObjectIdArray(values?: string[]): mongoose.Types.ObjectId[] {
  return (values ?? []).map((id) => new mongoose.Types.ObjectId(id));
}

function mapTranslation(doc: {
  languageCode: string;
  title: string;
  slug: string;
  author?: string;
  translator?: string;
  commentator?: string;
  shortDescription?: string;
  detailedDescription?: string;
  contentHighlights?: string[];
  seo?: BookTranslation['seo'];
}): BookTranslation {
  return {
    languageCode: doc.languageCode,
    title: doc.title,
    slug: doc.slug,
    author: doc.author,
    translator: doc.translator,
    commentator: doc.commentator,
    shortDescription: doc.shortDescription,
    detailedDescription: doc.detailedDescription,
    contentHighlights: doc.contentHighlights,
    seo: doc.seo,
  };
}

function toDto(book: IBook, translations: BookTranslation[]): BookDto {
  return {
    id: book._id.toString(),
    sku: book.sku,
    categoryIds: book.categoryIds.map((id) => id.toString()),
    subjectIds: book.subjectIds.map((id) => id.toString()),
    tagIds: book.tagIds.map((id) => id.toString()),
    languageId: book.languageId?.toString(),
    availabilityId: book.availabilityId?.toString(),
    physical: book.physical ?? {},
    publishing: book.publishing ?? {},
    commercial: book.commercial ?? { currency: 'INR' },
    fieldVisibility: book.fieldVisibility ?? {},
    priceVisibility: book.priceVisibility ?? {},
    coverMediaId: book.coverMediaId?.toString(),
    galleryMediaIds: book.galleryMediaIds.map((id) => id.toString()),
    isFeatured: book.isFeatured,
    publishStatus: book.publishStatus,
    publishedAt: book.publishedAt?.toISOString(),
    translations,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

async function loadTranslations(bookId: string): Promise<BookTranslation[]> {
  const docs = await BookTranslationModel.find({ bookId }).sort({ languageCode: 1 });
  return docs.map((doc) => mapTranslation(doc));
}

async function assertSlugAvailable(
  translations: Array<{ languageCode: string; slug: string }>,
  excludeBookId?: string,
): Promise<void> {
  for (const translation of translations) {
    const query: Record<string, unknown> = {
      languageCode: translation.languageCode,
      slug: translation.slug.toLowerCase(),
    };
    if (excludeBookId) query.bookId = { $ne: excludeBookId };
    const existing = await BookTranslationModel.findOne(query);
    if (existing) {
      throw new BookError(
        'SLUG_EXISTS',
        `Slug "${translation.slug}" already exists for ${translation.languageCode}`,
      );
    }
  }
}

async function upsertTranslations(
  bookId: string,
  translations: BookTranslation[],
): Promise<BookTranslation[]> {
  await assertSlugAvailable(translations, bookId);

  const existing = await BookTranslationModel.find({ bookId });
  const incomingCodes = new Set(translations.map((t) => t.languageCode));

  for (const doc of existing) {
    if (!incomingCodes.has(doc.languageCode)) {
      await doc.deleteOne();
    }
  }

  const saved: BookTranslation[] = [];
  for (const translation of translations) {
    const doc = await BookTranslationModel.findOneAndUpdate(
      { bookId, languageCode: translation.languageCode },
      {
        bookId,
        languageCode: translation.languageCode,
        title: translation.title,
        slug: translation.slug.toLowerCase(),
        author: translation.author,
        translator: translation.translator,
        commentator: translation.commentator,
        shortDescription: translation.shortDescription,
        detailedDescription: translation.detailedDescription,
        contentHighlights: translation.contentHighlights,
        seo: translation.seo ?? { indexable: true },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    saved.push(mapTranslation(doc));
  }

  return saved;
}

function pickTranslation(
  translations: BookTranslation[],
  lang?: string,
  fallbackLang = 'en',
): BookTranslation | undefined {
  return (
    translations.find((t) => t.languageCode === lang) ??
    translations.find((t) => t.languageCode === fallbackLang) ??
    translations[0]
  );
}

export function toPublicBookDto(book: BookDto, lang?: string): PublicBookDto {
  const translation = pickTranslation(book.translations, lang);
  return {
    ...book,
    displayTitle: translation?.title ?? 'Untitled',
    displaySlug: translation?.slug ?? '',
    displayAuthor: translation?.author,
  };
}

export async function listBooks(filters: {
  search?: string;
  status?: BookPublishStatus;
  categoryId?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}): Promise<BookListResult> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const query: Record<string, unknown> = {};

  if (filters.status) query.publishStatus = filters.status;
  else query.publishStatus = { $ne: 'archived' };

  if (filters.categoryId) query.categoryIds = filters.categoryId;
  if (filters.featured !== undefined) query.isFeatured = filters.featured;

  let bookIds: string[] | undefined;
  if (filters.search) {
    const matches = await BookTranslationModel.find({
      $or: [
        { title: { $regex: filters.search, $options: 'i' } },
        { author: { $regex: filters.search, $options: 'i' } },
        { slug: { $regex: filters.search, $options: 'i' } },
      ],
    }).select('bookId');
    bookIds = [...new Set(matches.map((m) => m.bookId.toString()))];
    if (bookIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }
    query._id = { $in: bookIds };
  }

  const [books, total] = await Promise.all([
    Book.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Book.countDocuments(query),
  ]);

  const items = await Promise.all(
    books.map(async (book) => toDto(book, await loadTranslations(book._id.toString()))),
  );

  return { items, total, page, limit };
}

export async function listPublicBooks(filters: {
  search?: string;
  categoryId?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
  lang?: string;
}): Promise<{ items: PublicBookDto[]; total: number; page: number; limit: number }> {
  const result = await listBooks({
    ...filters,
    status: 'published',
  });
  return {
    ...result,
    items: result.items.map((book) => toPublicBookDto(book, filters.lang)),
  };
}

export async function getBookById(id: string): Promise<BookDto | null> {
  const book = await Book.findById(id);
  if (!book) return null;
  return toDto(book, await loadTranslations(id));
}

export async function getBookBySlug(
  slug: string,
  lang = 'en',
  publicOnly = false,
): Promise<PublicBookDto | null> {
  const translation = await BookTranslationModel.findOne({
    slug: slug.toLowerCase(),
    languageCode: lang,
  });
  if (!translation) {
    const fallback = await BookTranslationModel.findOne({ slug: slug.toLowerCase() });
    if (!fallback) return null;
    const book = await Book.findById(fallback.bookId);
    if (!book) return null;
    if (publicOnly && book.publishStatus !== 'published') return null;
    const translations = await loadTranslations(book._id.toString());
    return toPublicBookDto(toDto(book, translations), lang);
  }

  const book = await Book.findById(translation.bookId);
  if (!book) return null;
  if (publicOnly && book.publishStatus !== 'published') return null;
  const translations = await loadTranslations(book._id.toString());
  return toPublicBookDto(toDto(book, translations), lang);
}

export async function createBook(
  input: {
    sku?: string;
    categoryIds?: string[];
    subjectIds?: string[];
    tagIds?: string[];
    languageId?: string;
    availabilityId?: string;
    physical?: IBook['physical'];
    publishing?: IBook['publishing'];
    commercial?: IBook['commercial'];
    fieldVisibility?: IBook['fieldVisibility'];
    priceVisibility?: IBook['priceVisibility'];
    coverMediaId?: string;
    galleryMediaIds?: string[];
    isFeatured?: boolean;
    publishStatus?: BookPublishStatus;
    translations: BookTranslation[];
  },
  createdBy?: string,
): Promise<BookDto> {
  if (input.sku) {
    const existingSku = await Book.findOne({ sku: input.sku });
    if (existingSku) throw new BookError('SKU_EXISTS', 'SKU already exists');
  }

  await assertSlugAvailable(input.translations);

  const publishStatus = input.publishStatus ?? 'draft';
  const book = await Book.create({
    sku: input.sku,
    categoryIds: toObjectIdArray(input.categoryIds),
    subjectIds: toObjectIdArray(input.subjectIds),
    tagIds: toObjectIdArray(input.tagIds),
    languageId: toObjectId(input.languageId),
    availabilityId: toObjectId(input.availabilityId),
    physical: input.physical ?? {},
    publishing: input.publishing ?? {},
    commercial: input.commercial ?? { currency: 'INR' },
    fieldVisibility: input.fieldVisibility ?? {},
    priceVisibility: input.priceVisibility ?? {},
    coverMediaId: toObjectId(input.coverMediaId),
    galleryMediaIds: toObjectIdArray(input.galleryMediaIds),
    isFeatured: input.isFeatured ?? false,
    publishStatus,
    publishedAt: publishStatus === 'published' ? new Date() : undefined,
    createdBy,
  });

  const translations = await upsertTranslations(book._id.toString(), input.translations);
  return toDto(book, translations);
}

export async function updateBook(
  id: string,
  input: Partial<{
    sku: string | null;
    categoryIds: string[];
    subjectIds: string[];
    tagIds: string[];
    languageId: string | null;
    availabilityId: string | null;
    physical: IBook['physical'];
    publishing: IBook['publishing'];
    commercial: IBook['commercial'];
    fieldVisibility: IBook['fieldVisibility'];
    priceVisibility: IBook['priceVisibility'];
    coverMediaId: string | null;
    galleryMediaIds: string[];
    isFeatured: boolean;
    publishStatus: BookPublishStatus;
    translations: BookTranslation[];
  }>,
): Promise<BookDto> {
  const book = await Book.findById(id);
  if (!book) throw new BookError('NOT_FOUND', 'Book not found');

  if (input.sku !== undefined) {
    if (input.sku) {
      const existingSku = await Book.findOne({ sku: input.sku, _id: { $ne: id } });
      if (existingSku) throw new BookError('SKU_EXISTS', 'SKU already exists');
      book.sku = input.sku;
    } else {
      book.sku = undefined;
    }
  }

  if (input.categoryIds !== undefined) book.categoryIds = toObjectIdArray(input.categoryIds);
  if (input.subjectIds !== undefined) book.subjectIds = toObjectIdArray(input.subjectIds);
  if (input.tagIds !== undefined) book.tagIds = toObjectIdArray(input.tagIds);
  if (input.languageId !== undefined) {
    book.languageId = input.languageId ? toObjectId(input.languageId) : undefined;
  }
  if (input.availabilityId !== undefined) {
    book.availabilityId = input.availabilityId ? toObjectId(input.availabilityId) : undefined;
  }
  if (input.physical) book.physical = { ...book.physical, ...input.physical };
  if (input.publishing) book.publishing = { ...book.publishing, ...input.publishing };
  if (input.commercial) book.commercial = { ...book.commercial, ...input.commercial };
  if (input.fieldVisibility) {
    book.fieldVisibility = { ...book.fieldVisibility, ...input.fieldVisibility };
  }
  if (input.priceVisibility) {
    book.priceVisibility = { ...book.priceVisibility, ...input.priceVisibility };
  }
  if (input.coverMediaId !== undefined) {
    book.coverMediaId = input.coverMediaId ? toObjectId(input.coverMediaId) : undefined;
  }
  if (input.galleryMediaIds !== undefined) {
    book.galleryMediaIds = toObjectIdArray(input.galleryMediaIds);
  }
  if (input.isFeatured !== undefined) book.isFeatured = input.isFeatured;
  if (input.publishStatus !== undefined) {
    book.publishStatus = input.publishStatus;
    if (input.publishStatus === 'published' && !book.publishedAt) {
      book.publishedAt = new Date();
    }
  }

  await book.save();

  const translations = input.translations
    ? await upsertTranslations(id, input.translations)
    : await loadTranslations(id);

  return toDto(book, translations);
}

export async function publishBook(id: string): Promise<BookDto> {
  return updateBook(id, { publishStatus: 'published' });
}

export async function archiveBook(id: string): Promise<BookDto> {
  return updateBook(id, { publishStatus: 'archived' });
}

export async function deleteBook(id: string): Promise<void> {
  const book = await Book.findById(id);
  if (!book) throw new BookError('NOT_FOUND', 'Book not found');
  await BookTranslationModel.deleteMany({ bookId: id });
  await book.deleteOne();
}

export function resolveBookTitle(
  book: BookDto | PublicBookDto,
  lang: string,
  fallbackLang = 'en',
): string {
  if ('displayTitle' in book && book.displayTitle) return book.displayTitle;
  const translation = pickTranslation(book.translations, lang, fallbackLang);
  return translation?.title ?? 'Untitled';
}
