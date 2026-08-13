'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CategoryDto } from '@dsb/shared';
import { apiFetch } from '@/lib/api-client';
import { usePublicLang } from '@/lib/public-lang';

export function FeaturedCategories() {
  const { lang } = usePublicLang();
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  useEffect(() => {
    apiFetch<CategoryDto[]>('/public/categories/featured')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  if (categories.length === 0) {
    return <p className="text-sm text-muted">Featured categories will appear here once published.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const name =
          category.translations.find((t) => t.languageCode === lang)?.name ??
          category.translations.find((t) => t.languageCode === 'en')?.name ??
          category.slug;
        return (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="rounded-lg border border-border p-4 hover:bg-accent/30"
          >
            {name}
          </Link>
        );
      })}
    </div>
  );
}
