'use client';

import Link from 'next/link';

const PUBLIC_NAV = [
  { href: '/', label: 'Home' },
  { href: '/books', label: 'Books' },
  { href: '/categories', label: 'Categories' },
  { href: '/wholesale', label: 'Wholesale' },
  { href: '/enquiry', label: 'Enquiry' },
  { href: '/contact', label: 'Contact' },
  { href: '/track', label: 'Track Enquiry' },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Durga Sahitya Bhandar
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/enquiry"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Enquire
        </Link>
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
      </div>
    </footer>
  );
}
