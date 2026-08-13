import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { Button } from '@/components/ui/button';

export default function PublicHomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">B2B Publishing</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Religious books for institutions, distributors & booksellers
            </h1>
            <p className="mt-6 text-lg text-muted">
              Browse our catalogue, submit wholesale enquiries, and track your requests — all in one
              professional platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/books">
                <Button size="lg">Browse Catalogue</Button>
              </Link>
              <Link href="/enquiry">
                <Button size="lg" variant="secondary">
                  Submit Enquiry
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6">
            {[
              { title: 'Catalogue', desc: 'Search and filter books by category, language, and subject.' },
              { title: 'Wholesale Enquiries', desc: 'Request quotes for bulk orders without checkout.' },
              { title: 'Track Progress', desc: 'Follow your enquiry status securely after submission.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border p-6">
                <h2 className="font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
