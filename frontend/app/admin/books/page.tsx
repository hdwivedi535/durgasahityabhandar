'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BookDto, BookListResult } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiDownloadWithToken, apiFetchWithToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { BookForm } from '@/components/admin/book-form';
import { CatalogueImportModal } from '@/components/admin/catalogue-import-modal';

function bookTitle(book: BookDto): string {
  return (
    book.translations.find((t) => t.languageCode === 'en')?.title ??
    book.translations[0]?.title ??
    'Untitled'
  );
}

export default function AdminBooksPage() {
  const { accessToken } = useAuth();
  const [books, setBooks] = useState<BookDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BookDto | null>(null);
  const [showImport, setShowImport] = useState(false);

  const loadBooks = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const data = await apiFetchWithToken<BookListResult>(
        `/admin/books?${params.toString()}`,
        accessToken,
      );
      setBooks(data.items);
      setTotal(data.total);
    } catch {
      setError('Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [accessToken, search]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  async function handlePublish(book: BookDto) {
    if (!accessToken) return;
    await apiFetchWithToken(`/admin/books/${book.id}/publish`, accessToken, { method: 'POST' });
    await loadBooks();
  }

  async function handleArchive(book: BookDto) {
    if (!accessToken) return;
    if (!window.confirm(`Archive "${bookTitle(book)}"?`)) return;
    await apiFetchWithToken(`/admin/books/${book.id}/archive`, accessToken, { method: 'POST' });
    await loadBooks();
  }

  async function handleDelete(book: BookDto) {
    if (!accessToken) return;
    if (
      !window.confirm(
        `Permanently delete "${bookTitle(book)}"? This cannot be undone. Prefer Archive if you may need the record later.`,
      )
    ) {
      return;
    }
    await apiFetchWithToken(`/admin/books/${book.id}`, accessToken, { method: 'DELETE' });
    await loadBooks();
  }

  async function handleExport(format: 'csv' | 'xlsx') {
    if (!accessToken) return;
    const params = new URLSearchParams({ format });
    if (search.trim()) params.set('search', search.trim());
    await apiDownloadWithToken(
      `/admin/books/export?${params.toString()}`,
      accessToken,
      `books-export.${format}`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Books</h1>
          <p className="mt-1 text-sm text-muted">
            Manage catalogue entries — bulk import, export, images, and publish status
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setShowImport(true)}>
            Import
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleExport('csv')}>
            Export CSV
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleExport('xlsx')}>
            Export Excel
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            Add Book
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, author, or slug"
          className="h-10 flex-1 rounded-lg border border-border px-3 text-sm"
        />
        <Button type="button" variant="secondary" onClick={loadBooks}>
          Search
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-medium">Catalogue ({total})</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : books.length === 0 ? (
              <p className="text-sm text-muted">No books yet. Create or import your first books.</p>
            ) : (
              <div className="space-y-3">
                {books.map((book) => {
                  const translation =
                    book.translations.find((t) => t.languageCode === 'en') ?? book.translations[0];
                  const cover = book.imageUrls?.[0];
                  return (
                    <div
                      key={book.id}
                      className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt={bookTitle(book)}
                            className="h-16 w-12 rounded border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-12 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted">
                            No img
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{bookTitle(book)}</p>
                          <p className="text-sm text-muted">
                            {translation?.author ? `${translation.author} · ` : ''}
                            {translation?.slug} · {book.publishStatus}
                            {book.isFeatured ? ' · featured' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditing(book);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </Button>
                        {book.publishStatus !== 'published' && (
                          <Button type="button" onClick={() => handlePublish(book)}>
                            Publish
                          </Button>
                        )}
                        {book.publishStatus !== 'archived' && (
                          <Button type="button" variant="secondary" onClick={() => handleArchive(book)}>
                            Archive
                          </Button>
                        )}
                        <Button type="button" variant="secondary" onClick={() => handleDelete(book)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {showForm && accessToken && (
          <Card>
            <CardHeader>
              <h2 className="font-medium">{editing ? 'Edit Book' : 'New Book'}</h2>
            </CardHeader>
            <CardContent>
              <BookForm
                accessToken={accessToken}
                book={editing}
                onSuccess={() => {
                  setShowForm(false);
                  setEditing(null);
                  loadBooks();
                }}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {accessToken && (
        <CatalogueImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          accessToken={accessToken}
          entity="books"
          onImported={loadBooks}
        />
      )}
    </div>
  );
}
