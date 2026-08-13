'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CategoryDto, PublicBookDto, PublicBookListResult } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { apiFetch } from '@/lib/api-client';

interface CategoryDetail extends CategoryDto {
  children: CategoryDto[];
}

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [books, setBooks] = useState<PublicBookDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    apiFetch<CategoryDetail>(`/public/categories/${params.slug}`)
      .then((data) => {
        setCategory(data);
        return apiFetch<PublicBookListResult>(
          `/public/books?categoryId=${data.id}&lang=en&limit=50`,
        );
      })
      .then((result) => setBooks(result.items))
      .catch(() => {
        setCategory(null);
        setBooks([]);
      })
      .finally(() => setLoading(false));
  }, [params.slug]);

  const name =
    category?.translations.find((t) => t.languageCode === 'en')?.name ?? category?.slug;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <Link href="/categories" className="text-sm text-muted hover:text-foreground">
          ← All Categories
        </Link>

        {loading && <p className="mt-6 text-muted">Loading…</p>}

        {!loading && !category && (
          <p className="mt-6 text-muted">Category not found.</p>
        )}

        {category && (
          <>
            <h1 className="mt-4 text-3xl font-semibold">{name}</h1>
            {category.translations.find((t) => t.languageCode === 'en')?.description && (
              <p className="mt-4 text-muted">
                {category.translations.find((t) => t.languageCode === 'en')?.description}
              </p>
            )}

            {category.children.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-medium">Subcategories</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {category.children.map((child) => {
                    const childName =
                      child.translations.find((t) => t.languageCode === 'en')?.name ?? child.slug;
                    return (
                      <Link
                        key={child.id}
                        href={`/categories/${child.slug}`}
                        className="rounded-lg border border-border p-4 hover:bg-accent/30"
                      >
                        {childName}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mt-10">
              <h2 className="text-lg font-medium">Books</h2>
              {books.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
                  No published books in this category yet.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {books.map((book) => (
                    <Link
                      key={book.id}
                      href={`/books/${book.displaySlug}`}
                      className="rounded-lg border border-border p-4 hover:bg-accent/30"
                    >
                      <p className="font-medium">{book.displayTitle}</p>
                      {book.displayAuthor && (
                        <p className="mt-1 text-sm text-muted">{book.displayAuthor}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
