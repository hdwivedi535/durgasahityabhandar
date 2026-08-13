'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CategoryDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { apiFetch } from '@/lib/api-client';

interface CategoryDetail extends CategoryDto {
  children: CategoryDto[];
}

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    apiFetch<CategoryDetail>(`/public/categories/${params.slug}`)
      .then(setCategory)
      .catch(() => setCategory(null))
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
              <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
                Books in this category will appear here once the book catalogue is published (Phase 3
                continuation).
              </p>
            </section>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
