'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicBookDto, PublicBookListResult } from '@dsb/shared';
import { apiFetch } from '@/lib/api-client';
import { usePublicLang } from '@/lib/public-lang';

export function FeaturedBooks({ limit = 8 }: { limit?: number }) {
  const { lang } = usePublicLang();
  const [books, setBooks] = useState<PublicBookDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PublicBookDto[]>(`/public/books/featured?lang=${lang}`)
      .then((items) => {
        if (items.length > 0) return items;
        return apiFetch<PublicBookListResult>(`/public/books?lang=${lang}&limit=${limit}`).then(
          (r) => r.items,
        );
      })
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [lang, limit]);

  if (loading) {
    return <p className="text-sm text-muted">Loading catalogue…</p>;
  }

  if (books.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
        Published books will appear here once they are added in the admin catalogue.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {books.slice(0, limit).map((book) => (
        <Link
          key={book.id}
          href={`/books/${book.displaySlug}`}
          className="group overflow-hidden rounded-lg border border-border hover:bg-accent/30"
        >
          {book.imageUrls?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.imageUrls[0]}
              alt={book.displayTitle}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center bg-accent/20 text-xs text-muted">
              No cover
            </div>
          )}
          <div className="p-3">
            <h3 className="font-medium group-hover:underline">{book.displayTitle}</h3>
            {book.displayAuthor && (
              <p className="mt-1 text-sm text-muted">{book.displayAuthor}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
