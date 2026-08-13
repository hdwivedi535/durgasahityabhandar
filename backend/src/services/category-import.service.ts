import type {
  CategoryImportConfirmResult,
  CategoryImportPayload,
  CategoryImportPreviewResult,
  CategoryImportRowPreview,
  CategoryStatus,
  ImportPreviewSummary,
} from '@dsb/shared';
import {
  CATEGORY_IMPORT_COLUMNS,
  emptyCategoryTemplateRow,
  type CategoryImportColumn,
} from '@dsb/shared';
import { Category } from '../models/category.model';
import { createCategory, updateCategory } from './category.service';
import {
  buildCsvBuffer,
  buildXlsxBuffer,
  detectSpreadsheetFormat,
  parseBoolean,
  parseOptionalNumber,
  parseSpreadsheetBuffer,
  slugify,
  type SpreadsheetFormat,
} from '../utils/spreadsheet';

const LANGS = ['en', 'hi', 'sa', 'ne'] as const;

function cell(row: Record<string, string>, key: string): string {
  return (row[key] ?? '').trim();
}

export async function previewCategoryImport(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<CategoryImportPreviewResult> {
  const format = detectSpreadsheetFormat(filename, mimeType);
  const rawRows = parseSpreadsheetBuffer(buffer, format);
  const rows: CategoryImportRowPreview[] = [];
  const seenSlugs = new Set<string>();

  // Pass 1: parse + validate individually (parent resolution checked after)
  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2;
    const raw = rawRows[i];
    const errors: CategoryImportRowPreview['errors'] = [];
    const warnings: string[] = [];

    let slug = cell(raw, 'slug');
    const nameEn = cell(raw, 'name_en');
    if (!slug && nameEn) slug = slugify(nameEn);
    if (!slug) {
      errors.push({ field: 'slug', message: 'Slug is required' });
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.push({ field: 'slug', message: `Invalid slug: ${slug}` });
    } else if (seenSlugs.has(slug)) {
      errors.push({ field: 'slug', message: 'Duplicate slug within file' });
    } else {
      seenSlugs.add(slug);
    }

    const parentSlugRaw = cell(raw, 'parentSlug');
    const parentSlug = parentSlugRaw ? parentSlugRaw.toLowerCase() : null;

    let status: CategoryStatus = 'draft';
    const statusRaw = cell(raw, 'status') || 'draft';
    if (!['draft', 'published', 'hidden', 'archived'].includes(statusRaw)) {
      errors.push({ field: 'status', message: `Invalid status: ${statusRaw}` });
    } else {
      status = statusRaw as CategoryStatus;
    }

    let isVisible = true;
    let isFeatured = false;
    let displayOrder: number | undefined;
    try {
      isVisible = parseBoolean(cell(raw, 'isVisible'), true);
      isFeatured = parseBoolean(cell(raw, 'isFeatured'), false);
      displayOrder = parseOptionalNumber(cell(raw, 'displayOrder'));
    } catch (err) {
      errors.push({
        field: 'flags',
        message: err instanceof Error ? err.message : 'Invalid flag/number',
      });
    }

    const translations = LANGS.filter((lang) => cell(raw, `name_${lang}`)).map((lang) => ({
      languageCode: lang,
      name: cell(raw, `name_${lang}`),
      shortDescription: cell(raw, `shortDescription_${lang}`) || undefined,
      description: cell(raw, `description_${lang}`) || undefined,
    }));

    if (translations.length === 0) {
      errors.push({ field: 'name_en', message: 'At least one category name is required' });
    }

    const existing = slug
      ? await Category.findOne({ slug: slug.toLowerCase() }).select('_id')
      : null;

    // Parent must exist in DB or earlier in file (validated in pass 2 for file order)
    if (parentSlug) {
      const parentInDb = await Category.findOne({
        slug: parentSlug,
        status: { $ne: 'archived' },
      }).select('_id');
      const parentInFile = rawRows.some((r, idx) => {
        if (idx >= i) return false;
        const s = cell(r, 'slug') || slugify(cell(r, 'name_en'));
        return s.toLowerCase() === parentSlug;
      });
      if (!parentInDb && !parentInFile) {
        errors.push({
          field: 'parentSlug',
          message: `Parent category not found: ${parentSlug}`,
        });
      }
      if (parentSlug === slug) {
        errors.push({ field: 'parentSlug', message: 'Category cannot be its own parent' });
      }
    }

    let action: CategoryImportRowPreview['action'] = 'create';
    if (errors.length > 0) action = 'error';
    else if (existing) {
      action = 'update';
      warnings.push(`Will update existing category ${existing._id.toString()}`);
    }

    const payload: CategoryImportPayload | undefined =
      action === 'error'
        ? undefined
        : {
            slug: slug.toLowerCase(),
            parentSlug,
            status,
            isVisible,
            isFeatured,
            displayOrder,
            translations,
            seo: {
              title: cell(raw, 'seoTitle') || undefined,
              description: cell(raw, 'seoDescription') || undefined,
            },
            existingCategoryId: existing?._id.toString(),
          };

    rows.push({
      rowNumber,
      action,
      slug: slug || undefined,
      name: translations[0]?.name,
      parentSlug,
      existingCategoryId: existing?._id.toString(),
      errors,
      warnings,
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

export async function confirmCategoryImport(
  payloads: CategoryImportPayload[],
  createdBy?: string,
): Promise<CategoryImportConfirmResult> {
  const result: CategoryImportConfirmResult = {
    total: payloads.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Process parents before children: sort so rows without parent come first, then by dependency
  const pending = [...payloads];
  const processedSlugs = new Set<string>();
  const maxPasses = pending.length + 2;
  let pass = 0;

  while (pending.length > 0 && pass < maxPasses) {
    pass += 1;
    let progressed = false;

    for (let i = 0; i < pending.length; ) {
      const payload = pending[i];
      const parentOk =
        !payload.parentSlug ||
        processedSlugs.has(payload.parentSlug) ||
        Boolean(await Category.findOne({ slug: payload.parentSlug }));

      if (!parentOk) {
        i += 1;
        continue;
      }

      try {
        let parentId: string | null = null;
        if (payload.parentSlug) {
          const parent = await Category.findOne({ slug: payload.parentSlug });
          if (!parent) {
            throw new Error(`Parent category not found: ${payload.parentSlug}`);
          }
          parentId = parent._id.toString();
        }

        if (payload.existingCategoryId) {
          await updateCategory(payload.existingCategoryId, {
            slug: payload.slug,
            status: payload.status,
            isVisible: payload.isVisible,
            isFeatured: payload.isFeatured,
            displayOrder: payload.displayOrder,
            translations: payload.translations,
            seo: { indexable: true, ...payload.seo },
          });
          // Reparent if needed via move would be separate; update parent through moveCategory path
          if (parentId !== undefined) {
            const { moveCategory } = await import('./category.service');
            await moveCategory(payload.existingCategoryId, parentId, payload.displayOrder);
          }
          result.updated += 1;
        } else {
          await createCategory(
            {
              parentId,
              slug: payload.slug,
              status: payload.status,
              isVisible: payload.isVisible,
              isFeatured: payload.isFeatured,
              displayOrder: payload.displayOrder,
              translations: payload.translations,
              seo: { indexable: true, ...payload.seo },
            },
            createdBy,
          );
          result.created += 1;
        }
        processedSlugs.add(payload.slug);
        pending.splice(i, 1);
        progressed = true;
      } catch (err) {
        result.failed += 1;
        result.errors.push({
          rowNumber: result.created + result.updated + result.failed,
          message: err instanceof Error ? err.message : 'Import failed',
        });
        pending.splice(i, 1);
        progressed = true;
      }
    }

    if (!progressed) {
      for (const leftover of pending) {
        result.failed += 1;
        result.errors.push({
          rowNumber: 0,
          message: `Could not resolve parent for category: ${leftover.slug}`,
        });
      }
      pending.length = 0;
    }
  }

  return result;
}

export async function exportCategories(options: {
  format: SpreadsheetFormat;
  search?: string;
}): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const query: Record<string, unknown> = { status: { $ne: 'archived' } };
  if (options.search) {
    query.$or = [
      { slug: { $regex: options.search, $options: 'i' } },
      { 'translations.name': { $regex: options.search, $options: 'i' } },
    ];
  }

  const categories = await Category.find(query).sort({ displayOrder: 1, createdAt: 1 });
  const byId = new Map(categories.map((c) => [c._id.toString(), c]));

  const rows: Array<Record<CategoryImportColumn, string>> = [];
  for (const category of categories) {
    const row = emptyCategoryTemplateRow();
    row.slug = category.slug;
    row.parentSlug = category.parentId
      ? byId.get(category.parentId.toString())?.slug ?? ''
      : '';
    row.status = category.status;
    row.isVisible = String(category.isVisible);
    row.isFeatured = String(category.isFeatured);
    row.displayOrder = String(category.displayOrder);
    for (const lang of LANGS) {
      const t = category.translations.find((tr) => tr.languageCode === lang);
      row[`name_${lang}` as CategoryImportColumn] = t?.name ?? '';
      row[`shortDescription_${lang}` as CategoryImportColumn] = t?.shortDescription ?? '';
      row[`description_${lang}` as CategoryImportColumn] = t?.description ?? '';
    }
    row.seoTitle = category.seo?.title ?? '';
    row.seoDescription = category.seo?.description ?? '';
    rows.push(row);
  }

  if (options.format === 'csv') {
    return {
      buffer: buildCsvBuffer(CATEGORY_IMPORT_COLUMNS, rows),
      filename: 'categories-export.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: buildXlsxBuffer(CATEGORY_IMPORT_COLUMNS, rows, 'Categories'),
    filename: 'categories-export.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export function buildCategoryTemplate(format: SpreadsheetFormat): {
  buffer: Buffer;
  filename: string;
  contentType: string;
} {
  const root = emptyCategoryTemplateRow();
  root.slug = 'religious-books';
  root.name_en = 'Religious Books';
  root.name_hi = 'धार्मिक पुस्तकें';
  root.status = 'published';

  const child = emptyCategoryTemplateRow();
  child.slug = 'hindu-scriptures';
  child.parentSlug = 'religious-books';
  child.name_en = 'Hindu Scriptures';
  child.name_hi = 'हिंदू शास्त्र';
  child.status = 'published';

  if (format === 'csv') {
    return {
      buffer: buildCsvBuffer(CATEGORY_IMPORT_COLUMNS, [root, child]),
      filename: 'categories-import-template.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: buildXlsxBuffer(CATEGORY_IMPORT_COLUMNS, [root, child], 'Categories'),
    filename: 'categories-import-template.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
