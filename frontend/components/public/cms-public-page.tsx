'use client';

import { useEffect, useState } from 'react';
import type { CmsPageDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { apiFetch } from '@/lib/api-client';
import { usePublicLang } from '@/lib/public-lang';

export function CmsPublicPage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const { lang } = usePublicLang();
  const [page, setPage] = useState<CmsPageDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<CmsPageDto>(`/public/pages/${slug}?lang=${lang}`)
      .then(setPage)
      .catch(() => setPage(null))
      .finally(() => setLoading(false));
  }, [slug, lang]);

  const translation = page?.translations[0];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        {loading && <p className="text-muted">Loading…</p>}
        {!loading && (
          <>
            <h1 className="text-3xl font-semibold">{translation?.title ?? fallbackTitle}</h1>
            <div className="mt-6 whitespace-pre-wrap text-muted">
              {translation?.body || 'This page is not published yet.'}
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
