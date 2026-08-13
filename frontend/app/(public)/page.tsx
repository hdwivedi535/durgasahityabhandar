'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HomepageSectionDto, PublicHomepageDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { FeaturedBooks } from '@/components/public/featured-books';
import { FeaturedCategories } from '@/components/public/featured-categories';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';

function HeroSection({ config }: { config: Record<string, unknown> }) {
  const eyebrow = String(config.eyebrow ?? '');
  const headline = String(config.headline ?? 'Durga Sahitya Bhandar');
  const subhead = String(config.subhead ?? '');
  const ctaLabel = String(config.ctaLabel ?? 'Browse Catalogue');
  const ctaHref = String(config.ctaHref ?? '/books');
  const secondaryCtaLabel = String(config.secondaryCtaLabel ?? '');
  const secondaryCtaHref = String(config.secondaryCtaHref ?? '/enquiry');

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-sm font-medium uppercase tracking-wide text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{headline}</h1>
        {subhead ? <p className="mt-6 text-lg text-muted">{subhead}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={ctaHref}>
            <Button size="lg">{ctaLabel}</Button>
          </Link>
          {secondaryCtaLabel ? (
            <Link href={secondaryCtaHref}>
              <Button size="lg" variant="secondary">
                {secondaryCtaLabel}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SectionBlock({ section }: { section: HomepageSectionDto }) {
  if (section.type === 'hero') return <HeroSection config={section.config} />;
  if (section.type === 'featured_books') {
    const count = Number(section.config.displayCount ?? 8);
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Featured books</h2>
            <p className="mt-2 text-sm text-muted">Published titles from the catalogue</p>
          </div>
          <Link href="/books" className="text-sm text-muted hover:text-foreground">
            View all →
          </Link>
        </div>
        <FeaturedBooks limit={count} />
      </section>
    );
  }
  if (section.type === 'categories') {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">Categories</h2>
          <Link href="/categories" className="text-sm text-muted hover:text-foreground">
            View all →
          </Link>
        </div>
        <FeaturedCategories />
      </section>
    );
  }
  const title = String(section.config.title ?? '');
  const body = String(section.config.body ?? '');
  if (!title && !body) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {title ? <h2 className="text-2xl font-semibold">{title}</h2> : null}
      {body ? <p className="mt-4 whitespace-pre-wrap text-muted">{body}</p> : null}
    </section>
  );
}

export default function PublicHomePage() {
  const [sections, setSections] = useState<HomepageSectionDto[] | null>(null);

  useEffect(() => {
    apiFetch<PublicHomepageDto>('/public/homepage')
      .then((data) => setSections(data.sections))
      .catch(() => setSections([]));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        {sections === null && <p className="px-6 py-12 text-muted">Loading…</p>}
        {sections && sections.length === 0 && (
          <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h1 className="text-4xl font-semibold">Durga Sahitya Bhandar</h1>
            <p className="mt-4 text-muted">The homepage will appear once sections are published.</p>
          </section>
        )}
        {sections?.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </main>
      <PublicFooter />
    </div>
  );
}
