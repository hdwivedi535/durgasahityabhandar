'use client';

import Link from 'next/link';
import { FooterCredit } from '@/components/ui/footer-credit';
import { useSiteSettings } from '@/lib/site-settings';
import { PUBLIC_LANGUAGES, usePublicLang } from '@/lib/public-lang';

export function PublicHeader() {
  const settings = useSiteSettings();
  const { lang, setLang } = usePublicLang();

  const nav = [
    { href: '/', label: 'Home', show: true },
    { href: '/books', label: 'Books', show: settings.features.book_catalogue },
    { href: '/categories', label: 'Categories', show: settings.features.book_catalogue },
    { href: '/wholesale', label: 'Wholesale', show: true },
    { href: '/about', label: 'About', show: true },
    { href: '/enquiry', label: 'Enquiry', show: settings.features.enquiries },
    { href: '/contact', label: 'Contact', show: true },
    { href: '/track', label: 'Track Enquiry', show: settings.features.public_tracking },
  ].filter((item) => item.show);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Durga Sahitya Bhandar
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="public-lang">
            Language
          </label>
          <select
            id="public-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
          >
            {PUBLIC_LANGUAGES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
          {settings.features.enquiries ? (
            <Link
              href="/enquiry"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Enquire
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Durga Sahitya Bhandar</p>
            <p className="mt-1 text-sm text-muted">Religious publishing for institutions & distributors</p>
          </div>
          <p className="text-sm text-muted">© {new Date().getFullYear()} Durga Sahitya Bhandar</p>
        </div>
        <FooterCredit className="mt-6 border-t border-border pt-6" />
      </div>
    </footer>
  );
}
