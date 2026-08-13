import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { Button } from '@/components/ui/button';

export default function WholesalePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Wholesale</h1>
        <p className="mt-3 text-muted">
          Durga Sahitya Bhandar supplies religious books to institutions, distributors, and
          booksellers. There is no online checkout — pricing and fulfilment are handled through
          enquiry.
        </p>

        <ol className="mt-10 space-y-6">
          {[
            {
              step: '1',
              title: 'Browse the catalogue',
              body: 'Review published titles, categories, and wholesale terms shown on each book.',
            },
            {
              step: '2',
              title: 'Send an enquiry',
              body: 'Tell us the titles, quantities, and delivery location. We match you as a trade customer.',
            },
            {
              step: '3',
              title: 'Quote and fulfilment',
              body: 'Our team confirms availability, wholesale rates, MOQ, and dispatch.',
            },
          ].map((item) => (
            <li key={item.step} className="rounded-lg border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Step {item.step}
              </p>
              <h2 className="mt-1 font-medium">{item.title}</h2>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/books">
            <Button>Browse books</Button>
          </Link>
          <Link href="/enquiry">
            <Button variant="secondary">Submit enquiry</Button>
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
