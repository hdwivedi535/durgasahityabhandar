'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CategoryTreeNode } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { apiFetch } from '@/lib/api-client';
import { usePublicLang } from '@/lib/public-lang';

function CategoryCard({
  node,
  depth = 0,
  lang,
}: {
  node: CategoryTreeNode;
  depth?: number;
  lang: string;
}) {
  const name =
    node.translations.find((t) => t.languageCode === lang)?.name ??
    node.translations.find((t) => t.languageCode === 'en')?.name ??
    node.slug;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <Link
        href={`/categories/${node.slug}`}
        className="block rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{name}</h3>
            {node.translations.find((t) => t.languageCode === lang)?.shortDescription && (
              <p className="mt-1 text-sm text-muted">
                {node.translations.find((t) => t.languageCode === lang)?.shortDescription}
              </p>
            )}
          </div>
          {node.isFeatured && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Featured</span>
          )}
        </div>
      </Link>
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <CategoryCard key={child.id} node={child} depth={depth + 1} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { lang } = usePublicLang();
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CategoryTreeNode[]>('/public/categories?tree=true')
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Categories</h1>
        <p className="mt-2 text-muted">Browse books by category</p>

        <div className="mt-8 space-y-3">
          {loading && <p className="text-muted">Loading categories…</p>}
          {!loading && tree.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-muted">
              Categories will appear here once published in the admin panel.
            </p>
          )}
          {tree.map((node) => (
            <CategoryCard key={node.id} node={node} lang={lang} />
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
