'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicBookListResult, PublicBookDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { apiFetch } from '@/lib/api-client';

export default function BooksPage() {
  const [books, setBooks] = useState<PublicBookDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ lang: 'en' });
    if (search.trim()) params.set('search', search.trim());
    apiFetch<PublicBookListResult>(`/public/books?${params.toString()}`)
      .then((data) => setBooks(data.items))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Books</h1>
        <p className="mt-2 text-muted">
          Browse our religious book catalogue. For wholesale enquiries, contact us.
        </p>

        <div className="mt-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search books by title or author"
            className="h-10 w-full rounded-lg border border-border px-3 text-sm sm:max-w-md"
          />
        </div>

        {loading && <p className="mt-8 text-muted">Loading…</p>}

        {!loading && books.length === 0 && (
          <p className="mt-8 rounded-lg border border-dashed border-border p-6 text-sm text-muted">
            No published books yet. Check back soon.
          </p>
        )}

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
      </main>
      <PublicFooter />
    </div>
  );
}
