import { describe, expect, it } from 'vitest';
import {
  buildCsvBuffer,
  detectSpreadsheetFormat,
  parseBoolean,
  parseOptionalNumber,
  parseSpreadsheetBuffer,
  slugify,
  splitList,
} from '../utils/spreadsheet';
import { isValidHttpUrl, validateImageUrl } from '../utils/image-url';
import { BOOK_IMPORT_COLUMNS, emptyBookTemplateRow } from '@dsb/shared';
import { CATEGORY_IMPORT_COLUMNS, emptyCategoryTemplateRow } from '@dsb/shared';

describe('spreadsheet utils', () => {
  it('detects csv and xlsx formats', () => {
    expect(detectSpreadsheetFormat('books.csv')).toBe('csv');
    expect(detectSpreadsheetFormat('books.xlsx')).toBe('xlsx');
    expect(() => detectSpreadsheetFormat('books.pdf')).toThrow(/Unsupported/);
  });

  it('parses UTF-8 CSV with quoted commas and unicode', () => {
    const csv = Buffer.from(
      'sku,title_en,title_hi,categorySlugs\n' +
        'DSB-1,"Gita, Bhagavad",भगवद्गीता,"scriptures;gita"\n',
      'utf8',
    );
    const rows = parseSpreadsheetBuffer(csv, 'csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe('DSB-1');
    expect(rows[0].title_en).toBe('Gita, Bhagavad');
    expect(rows[0].title_hi).toBe('भगवद्गीता');
    expect(splitList(rows[0].categorySlugs)).toEqual(['scriptures', 'gita']);
  });

  it('round-trips CSV template columns', () => {
    const sample = emptyBookTemplateRow();
    sample.sku = 'DSB-001';
    sample.title_en = 'Sample';
    sample.title_hi = 'नमूना';
    const buffer = buildCsvBuffer(BOOK_IMPORT_COLUMNS, [sample]);
    const rows = parseSpreadsheetBuffer(buffer, 'csv');
    expect(rows[0].sku).toBe('DSB-001');
    expect(rows[0].title_hi).toBe('नमूना');
  });

  it('parses booleans and numbers', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('0')).toBe(false);
    expect(parseOptionalNumber('12.5')).toBe(12.5);
    expect(parseOptionalNumber('')).toBeUndefined();
    expect(() => parseOptionalNumber('abc')).toThrow();
  });

  it('slugifies titles', () => {
    expect(slugify('Bhagavad Gita!')).toBe('bhagavad-gita');
  });

  it('builds category template columns', () => {
    const row = emptyCategoryTemplateRow();
    expect(CATEGORY_IMPORT_COLUMNS.includes('parentSlug')).toBe(true);
    expect(row.status).toBe('draft');
  });
});

describe('image url validation', () => {
  it('rejects invalid urls', async () => {
    expect(isValidHttpUrl('not-a-url')).toBe(false);
    const result = await validateImageUrl('ftp://example.com/a.jpg', { fetchRemote: false });
    expect(result.ok).toBe(false);
  });

  it('accepts image extensions without remote fetch', async () => {
    const result = await validateImageUrl('https://cdn.example.com/books/cover.png', {
      fetchRemote: false,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects unsupported extensions without remote fetch', async () => {
    const result = await validateImageUrl('https://cdn.example.com/books/file.pdf', {
      fetchRemote: false,
    });
    expect(result.ok).toBe(false);
  });
});
