'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CategoryTreeNode, PublicBookListResult, PublicBookDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { apiFetch } from '@/lib/api-client';

function flattenCategories(
  nodes: CategoryTreeNode[],
  prefix = '',
): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const node of nodes) {
    const name =
      node.translations.find((t) => t.languageCode === 'en')?.name ?? node.slug;
    const label = prefix ? `${prefix} / ${name}` : name;
    out.push({ id: node.id, label });
    if (node.children.length > 0) {
      out.push(...flattenCategories(node.children, label));
    }
  }
  return out;
}

export default function BooksPage() {
  const [books, setBooks] = useState<PublicBookDto[]>([]);
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    apiFetch<CategoryTreeNode[]>('/public/categories?tree=true')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ lang: 'en' });
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    setLoading(true);
    apiFetch<PublicBookListResult>(`/public/books?${params.toString()}`)
      .then((data) => setBooks(data.items))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [search, categoryId]);

  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Books</h1>
        <p className="mt-2 text-muted">
          Browse our religious book catalogue. For wholesale enquiries, contact us.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search books by title or author"
            className="h-10 w-full rounded-lg border border-border px-3 text-sm sm:max-w-md"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm sm:max-w-xs"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="mt-8 text-muted">Loading…</p>}

        {!loading && books.length === 0 && (
          <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-muted">
            No published books match these filters.
          </p>
        )}

        {!loading && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.displaySlug}`}
              className="group overflow-hidden rounded-lg border border-border hover:bg-accent/30"
            >
              {book.imageUrls?.[0] ? (
                <div className="overflow-hidden border-b border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={book.imageUrls[0]}
                    alt={book.displayTitle}
                    className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : null}
              <div className="p-5">
                <h2 className="font-medium">{book.displayTitle}</h2>
                {book.displayAuthor && (
                  <p className="mt-1 text-sm text-muted">{book.displayAuthor}</p>
                )}
                {book.translations.find((t) => t.languageCode === 'en')?.shortDescription && (
                  <p className="mt-2 text-sm text-muted line-clamp-2">
                    {book.translations.find((t) => t.languageCode === 'en')?.shortDescription}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
