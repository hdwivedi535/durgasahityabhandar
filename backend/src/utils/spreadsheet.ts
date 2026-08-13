import { parse as parseCsv } from 'csv-parse/sync';
import { stringify as stringifyCsv } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';

export type SpreadsheetFormat = 'csv' | 'xlsx';

export function detectSpreadsheetFormat(filename: string, mimeType?: string): SpreadsheetFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || mimeType?.includes('spreadsheetml')) return 'xlsx';
  if (lower.endsWith('.csv') || mimeType?.includes('csv') || mimeType?.includes('text/plain')) {
    return 'csv';
  }
  throw new Error('Unsupported file type. Upload a .csv or .xlsx file.');
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  format: SpreadsheetFormat,
): Record<string, string>[] {
  if (format === 'csv') {
    const records = parseCsv(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      bom: true,
      cast: false,
    }) as Record<string, unknown>[];
    return records.map(normalizeRowKeys);
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, codepage: 65001 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  return records.map(normalizeRowKeys);
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = key.trim();
    if (!normalized) continue;
    out[normalized] = value == null ? '' : String(value).trim();
  }
  return out;
}

export function buildCsvBuffer(
  columns: readonly string[],
  rows: Array<Record<string, string | number | boolean | undefined | null>>,
): Buffer {
  const data = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col];
      out[col] = value == null ? '' : String(value);
    }
    return out;
  });
  const csv = stringifyCsv(data, {
    header: true,
    columns: [...columns],
    bom: true,
  });
  return Buffer.from(csv, 'utf8');
}

export function buildXlsxBuffer(
  columns: readonly string[],
  rows: Array<Record<string, string | number | boolean | undefined | null>>,
  sheetName = 'Sheet1',
): Buffer {
  const data = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col];
      out[col] = value == null ? '' : String(value);
    }
    return out;
  });
  const worksheet = XLSX.utils.json_to_sheet(data, { header: [...columns] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out;
}

export function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value == null || value === '') return defaultValue;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

export function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Invalid number: ${value}`);
  return n;
}

export function splitList(value: string | undefined, separator = ';'): string[] {
  if (!value?.trim()) return [];
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
