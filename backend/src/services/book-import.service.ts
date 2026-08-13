import type {
  BookImportConfirmResult,
  BookImportPayload,
  BookImportPreviewResult,
  BookImportRowPreview,
  BookPublishStatus,
  BookTranslation,
  ImportPreviewSummary,
} from '@dsb/shared';
import {
  BOOK_IMPORT_COLUMNS,
  emptyBookTemplateRow,
  type BookImportColumn,
} from '@dsb/shared';
import { Book } from '../models/book.model';
import { BookTranslation as BookTranslationModel } from '../models/book-translation.model';
import { Category } from '../models/category.model';
import { createBook, updateBook } from './book.service';
import { validateImageUrls } from '../utils/image-url';
import {
  buildCsvBuffer,
  buildXlsxBuffer,
  detectSpreadsheetFormat,
  parseOptionalNumber,
  parseSpreadsheetBuffer,
  parseBoolean,
  slugify,
  splitList,
  type SpreadsheetFormat,
} from '../utils/spreadsheet';

const LANGS = ['en', 'hi', 'sa', 'ne'] as const;

function cell(row: Record<string, string>, key: string): string {
  return (row[key] ?? '').trim();
}

function buildTranslations(row: Record<string, string>): BookTranslation[] {
  const translations: BookTranslation[] = [];
  for (const lang of LANGS) {
    const title = cell(row, `title_${lang}`);
    if (!title) continue;
    let slug = cell(row, `slug_${lang}`);
    if (!slug) slug = slugify(title);
    translations.push({
      languageCode: lang,
      title,
      slug: slug.toLowerCase(),
      author: cell(row, `author_${lang}`) || undefined,
      shortDescription: cell(row, `shortDescription_${lang}`) || undefined,
      detailedDescription: cell(row, `detailedDescription_${lang}`) || undefined,
    });
  }
  return translations;
}

function buildImageUrls(row: Record<string, string>): string[] {
  return [cell(row, 'image1Url'), cell(row, 'image2Url'), cell(row, 'image3Url')].filter(Boolean);
}

async function resolveCategoryIds(slugs: string[]): Promise<{
  ids: string[];
  missing: string[];
}> {
  if (slugs.length === 0) return { ids: [], missing: [] };
  const categories = await Category.find({
    slug: { $in: slugs.map((s) => s.toLowerCase()) },
    status: { $ne: 'archived' },
  }).select('_id slug');
  const bySlug = new Map(categories.map((c) => [c.slug, c._id.toString()]));
  const ids: string[] = [];
  const missing: string[] = [];
  for (const slug of slugs) {
    const id = bySlug.get(slug.toLowerCase());
    if (id) ids.push(id);
    else missing.push(slug);
  }
  return { ids, missing };
}

async function findExistingBook(opts: {
  sku?: string;
  slugEn?: string;
}): Promise<{ id: string; sku?: string } | null> {
  if (opts.sku) {
    const bySku = await Book.findOne({ sku: opts.sku }).select('_id sku');
    if (bySku) return { id: bySku._id.toString(), sku: bySku.sku };
  }
  if (opts.slugEn) {
    const translation = await BookTranslationModel.findOne({
      languageCode: 'en',
      slug: opts.slugEn.toLowerCase(),
    }).select('bookId');
    if (translation) {
      const book = await Book.findById(translation.bookId).select('_id sku');
      if (book) return { id: book._id.toString(), sku: book.sku };
    }
  }
  return null;
}

export async function previewBookImport(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
  options: { validateImagesRemote?: boolean } = {},
): Promise<BookImportPreviewResult> {
  const format = detectSpreadsheetFormat(filename, mimeType);
  const rawRows = parseSpreadsheetBuffer(buffer, format);
  const rows: BookImportRowPreview[] = [];

  const seenSkus = new Set<string>();
  const seenSlugs = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2; // header is row 1
    const raw = rawRows[i];
    const errors: BookImportRowPreview['errors'] = [];
    const warnings: string[] = [];

    let publishStatus: BookPublishStatus = 'draft';
    const statusRaw = cell(raw, 'publishStatus') || 'draft';
    if (!['draft', 'preview', 'published', 'archived'].includes(statusRaw)) {
      errors.push({ field: 'publishStatus', message: `Invalid status: ${statusRaw}` });
    } else {
      publishStatus = statusRaw as BookPublishStatus;
    }

    let isFeatured = false;
    try {
      isFeatured = parseBoolean(cell(raw, 'isFeatured'), false);
    } catch (err) {
      errors.push({
        field: 'isFeatured',
        message: err instanceof Error ? err.message : 'Invalid isFeatured',
      });
    }

    const sku = cell(raw, 'sku') || undefined;
    const categorySlugs = splitList(cell(raw, 'categorySlugs'));
    const translations = buildTranslations(raw);
    const imageUrls = buildImageUrls(raw);

    if (translations.length === 0) {
      errors.push({ field: 'title_en', message: 'At least one title is required' });
    }

    for (const t of translations) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.slug)) {
        errors.push({
          field: `slug_${t.languageCode}`,
          message: `Invalid slug: ${t.slug}`,
        });
      }
    }

    const slugEn = translations.find((t) => t.languageCode === 'en')?.slug;
    if (sku) {
      if (seenSkus.has(sku.toLowerCase())) {
        errors.push({ field: 'sku', message: 'Duplicate SKU within file' });
      }
      seenSkus.add(sku.toLowerCase());
    }
    if (slugEn) {
      if (seenSlugs.has(slugEn)) {
        errors.push({ field: 'slug_en', message: 'Duplicate English slug within file' });
      }
      seenSlugs.add(slugEn);
    }

    const { ids: categoryIds, missing } = await resolveCategoryIds(categorySlugs);
    for (const m of missing) {
      errors.push({ field: 'categorySlugs', message: `Category not found: ${m}` });
    }

    let pages: number | undefined;
    let mrp: number | undefined;
    let wholesalePrice: number | undefined;
    let moq: number | undefined;
    let publicationYear: number | undefined;
    try {
      pages = parseOptionalNumber(cell(raw, 'pages'));
      mrp = parseOptionalNumber(cell(raw, 'mrp'));
      wholesalePrice = parseOptionalNumber(cell(raw, 'wholesalePrice'));
      moq = parseOptionalNumber(cell(raw, 'moq'));
      publicationYear = parseOptionalNumber(cell(raw, 'publicationYear'));
    } catch (err) {
      errors.push({
        field: 'pricing',
        message: err instanceof Error ? err.message : 'Invalid numeric field',
      });
    }

    if (imageUrls.length > 3) {
      errors.push({ field: 'imageUrls', message: 'Maximum 3 images allowed' });
    }

    if (publishStatus === 'published' && imageUrls.length < 1) {
      errors.push({
        field: 'image1Url',
        message: 'Published books require Image 1 URL (cover)',
      });
    }

    const imageStatus = await validateImageUrls(imageUrls, {
      fetchRemote: options.validateImagesRemote ?? true,
    });
    for (let j = 0; j < imageStatus.length; j++) {
      if (!imageStatus[j].ok) {
        errors.push({
          field: `image${j + 1}Url`,
          message: imageStatus[j].message ?? 'Invalid image URL',
        });
      }
    }

    const existing = await findExistingBook({ sku, slugEn });
    let action: BookImportRowPreview['action'] = 'create';
    if (errors.length > 0) {
      action = 'error';
    } else if (existing) {
      action = 'update';
      warnings.push(`Will update existing book ${existing.id}`);
    }

    const payload: BookImportPayload | undefined =
      action === 'error'
        ? undefined
        : {
            sku,
            categorySlugs,
            categoryIds,
            publishStatus,
            isFeatured,
            physical: { pages },
            publishing: {
              isbn: cell(raw, 'isbn') || undefined,
              edition: cell(raw, 'edition') || undefined,
              publicationYear,
              publisher: cell(raw, 'publisher') || undefined,
            },
            commercial: {
              mrp,
              wholesalePrice,
              moq,
              currency: cell(raw, 'currency') || 'INR',
            },
            imageUrls,
            translations,
            existingBookId: existing?.id,
          };

    rows.push({
      rowNumber,
      action,
      sku,
      title: translations[0]?.title,
      slug: slugEn,
      existingBookId: existing?.id,
      errors,
      warnings,
      imageStatus,
      payload,
    });
  }

  const summary: ImportPreviewSummary = {
    total: rows.length,
    valid: rows.filter((r) => r.action === 'create' || r.action === 'update').length,
    invalid: rows.filter((r) => r.action === 'error').length,
    duplicates: rows.filter((r) => r.action === 'update').length,
    creates: rows.filter((r) => r.action === 'create').length,
    updates: rows.filter((r) => r.action === 'update').length,
  };

  return { summary, rows };
}

export async function confirmBookImport(
  payloads: BookImportPayload[],
  createdBy?: string,
): Promise<BookImportConfirmResult> {
  const result: BookImportConfirmResult = {
    total: payloads.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i];
    try {
      if (payload.existingBookId) {
        await updateBook(payload.existingBookId, {
          sku: payload.sku,
          categoryIds: payload.categoryIds,
          publishStatus: payload.publishStatus,
          isFeatured: payload.isFeatured,
          physical: payload.physical,
          publishing: payload.publishing,
          commercial: payload.commercial,
          imageUrls: payload.imageUrls,
          translations: payload.translations,
        });
        result.updated += 1;
      } else {
        await createBook(
          {
            sku: payload.sku,
            categoryIds: payload.categoryIds,
            publishStatus: payload.publishStatus,
            isFeatured: payload.isFeatured,
            physical: payload.physical,
            publishing: payload.publishing,
            commercial: payload.commercial,
            imageUrls: payload.imageUrls,
            translations: payload.translations,
          },
          createdBy,
        );
        result.created += 1;
      }
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        rowNumber: i + 1,
        message: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }

  return result;
}

export async function exportBooks(options: {
  format: SpreadsheetFormat;
  search?: string;
  status?: BookPublishStatus;
  categoryId?: string;
}): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const query: Record<string, unknown> = {};
  if (options.status) query.publishStatus = options.status;
  else query.publishStatus = { $ne: 'archived' };
  if (options.categoryId) query.categoryIds = options.categoryId;

  let books = await Book.find(query).sort({ updatedAt: -1 }).limit(5000);

  if (options.search) {
    const matches = await BookTranslationModel.find({
      $or: [
        { title: { $regex: options.search, $options: 'i' } },
        { author: { $regex: options.search, $options: 'i' } },
        { slug: { $regex: options.search, $options: 'i' } },
      ],
    }).select('bookId');
    const ids = new Set(matches.map((m) => m.bookId.toString()));
    books = books.filter((b) => ids.has(b._id.toString()));
  }

  const categoryIds = [...new Set(books.flatMap((b) => b.categoryIds.map((id) => id.toString())))];
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('slug');
  const categorySlugById = new Map(categories.map((c) => [c._id.toString(), c.slug]));

  const rows: Array<Record<BookImportColumn, string>> = [];
  for (const book of books) {
    const translations = await BookTranslationModel.find({ bookId: book._id });
    const byLang = new Map(translations.map((t) => [t.languageCode, t]));
    const row = emptyBookTemplateRow();
    row.sku = book.sku ?? '';
    row.publishStatus = book.publishStatus;
    row.isFeatured = String(book.isFeatured);
    row.categorySlugs = book.categoryIds
      .map((id) => categorySlugById.get(id.toString()) ?? '')
      .filter(Boolean)
      .join(';');
    for (const lang of LANGS) {
      const t = byLang.get(lang);
      row[`title_${lang}` as BookImportColumn] = t?.title ?? '';
      row[`slug_${lang}` as BookImportColumn] = t?.slug ?? '';
      row[`author_${lang}` as BookImportColumn] = t?.author ?? '';
      row[`shortDescription_${lang}` as BookImportColumn] = t?.shortDescription ?? '';
      row[`detailedDescription_${lang}` as BookImportColumn] = t?.detailedDescription ?? '';
    }
    row.pages = book.physical?.pages?.toString() ?? '';
    row.isbn = book.publishing?.isbn ?? '';
    row.edition = book.publishing?.edition ?? '';
    row.publicationYear = book.publishing?.publicationYear?.toString() ?? '';
    row.publisher = book.publishing?.publisher ?? '';
    row.mrp = book.commercial?.mrp?.toString() ?? '';
    row.wholesalePrice = book.commercial?.wholesalePrice?.toString() ?? '';
    row.moq = book.commercial?.moq?.toString() ?? '';
    row.currency = book.commercial?.currency ?? 'INR';
    row.image1Url = book.imageUrls?.[0] ?? '';
    row.image2Url = book.imageUrls?.[1] ?? '';
    row.image3Url = book.imageUrls?.[2] ?? '';
    rows.push(row);
  }

  if (options.format === 'csv') {
    return {
      buffer: buildCsvBuffer(BOOK_IMPORT_COLUMNS, rows),
      filename: 'books-export.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: buildXlsxBuffer(BOOK_IMPORT_COLUMNS, rows, 'Books'),
    filename: 'books-export.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export function buildBookTemplate(format: SpreadsheetFormat): {
  buffer: Buffer;
  filename: string;
  contentType: string;
} {
  const sample = emptyBookTemplateRow();
  sample.sku = 'DSB-001';
  sample.title_en = 'Sample Book';
  sample.slug_en = 'sample-book';
  sample.author_en = 'Author Name';
  sample.title_hi = 'नमूना पुस्तक';
  sample.slug_hi = 'namuna-pustak';
  sample.categorySlugs = 'religious-books';
  sample.publishStatus = 'draft';
  sample.image1Url = 'https://example.com/books/sample-1.jpg';
  sample.mrp = '299';
  sample.wholesalePrice = '199';

  if (format === 'csv') {
    return {
      buffer: buildCsvBuffer(BOOK_IMPORT_COLUMNS, [sample]),
      filename: 'books-import-template.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: buildXlsxBuffer(BOOK_IMPORT_COLUMNS, [sample], 'Books'),
    filename: 'books-import-template.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
