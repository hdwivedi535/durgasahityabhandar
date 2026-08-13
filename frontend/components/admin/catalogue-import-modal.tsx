'use client';

import { useState } from 'react';
import type {
  BookImportConfirmResult,
  BookImportPayload,
  BookImportPreviewResult,
  CategoryImportConfirmResult,
  CategoryImportPayload,
  CategoryImportPreviewResult,
} from '@dsb/shared';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { apiDownloadWithToken, apiFetchWithToken, apiUploadWithToken } from '@/lib/api-client';

type Entity = 'books' | 'categories';

interface CatalogueImportModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  entity: Entity;
  onImported: () => void;
}

export function CatalogueImportModal({
  open,
  onClose,
  accessToken,
  entity,
  onImported,
}: CatalogueImportModalProps) {
  const [preview, setPreview] = useState<BookImportPreviewResult | CategoryImportPreviewResult | null>(
    null,
  );
  const [result, setResult] = useState<BookImportConfirmResult | CategoryImportConfirmResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const base = entity === 'books' ? '/admin/books' : '/admin/categories';
  const title = entity === 'books' ? 'Import Books' : 'Import Categories';

  function reset() {
    setPreview(null);
    setResult(null);
    setError('');
  }

  async function downloadTemplate(format: 'csv' | 'xlsx') {
    await apiDownloadWithToken(
      `${base}/import/template?format=${format}`,
      accessToken,
      `${entity}-import-template.${format}`,
    );
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUploadWithToken<BookImportPreviewResult | CategoryImportPreviewResult>(
        `${base}/import/preview`,
        accessToken,
        form,
      );
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  function downloadErrorReport() {
    if (!preview) return;
    const lines = ['rowNumber,field,message'];
    for (const row of preview.rows) {
      if (row.action !== 'error') continue;
      for (const err of row.errors) {
        lines.push(`${row.rowNumber},"${err.field}","${err.message.replace(/"/g, '""')}"`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity}-import-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmImport() {
    if (!preview) return;
    const payloads = preview.rows
      .filter((r) => r.action === 'create' || r.action === 'update')
      .map((r) => r.payload)
      .filter(Boolean) as Array<BookImportPayload | CategoryImportPayload>;

    if (payloads.length === 0) {
      setError('No valid rows to import');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiFetchWithToken<BookImportConfirmResult | CategoryImportConfirmResult>(
        `${base}/import/confirm`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ rows: payloads }),
        },
      );
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        reset();
        onClose();
      }}
      wide
    >
      {!result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => downloadTemplate('csv')}>
              Download CSV Template
            </Button>
            <Button type="button" variant="secondary" onClick={() => downloadTemplate('xlsx')}>
              Download Excel Template
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium">Choose CSV/XLSX</label>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-2 block w-full text-sm"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {loading && <p className="text-sm text-muted">Processing…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-medium">Import Preview</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <p>Total: {preview.summary.total}</p>
                  <p>Valid: {preview.summary.valid}</p>
                  <p>Creates: {preview.summary.creates}</p>
                  <p>Updates: {preview.summary.updates}</p>
                  <p>Duplicates: {preview.summary.duplicates}</p>
                  <p>Errors: {preview.summary.invalid}</p>
                </div>
              </div>

              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent/40">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Key</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.action}</td>
                        <td className="px-3 py-2">
                          {'title' in row
                            ? row.sku || row.slug || row.title
                            : 'name' in row
                              ? row.slug || row.name
                              : row.slug}
                        </td>
                        <td className="px-3 py-2 text-red-700">
                          {row.errors.map((e) => `${e.field}: ${e.message}`).join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                {preview.summary.invalid > 0 && (
                  <Button type="button" variant="secondary" onClick={downloadErrorReport}>
                    Download Error Report
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  loading={loading}
                  disabled={preview.summary.valid === 0}
                  onClick={confirmImport}
                >
                  Import Valid Rows
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <h3 className="font-medium">Import Complete</h3>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <p>Created: {result.created}</p>
            <p>Updated: {result.updated}</p>
            <p>Skipped: {result.skipped}</p>
            <p>Failed: {result.failed}</p>
          </div>
          {result.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
              {result.errors.map((e, i) => (
                <li key={`${e.rowNumber}-${i}`}>
                  Row {e.rowNumber}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
