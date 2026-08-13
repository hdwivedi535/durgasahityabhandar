import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Contact</h1>
        <p className="mt-3 text-muted">
          For catalogue, wholesale, or dispatch questions, send an enquiry so our team can respond
          with the right titles and quantities.
        </p>

        <div className="mt-8 space-y-4 rounded-lg border border-border p-5">
          <div>
            <p className="text-sm font-medium">Publisher</p>
            <p className="text-muted">Durga Sahitya Bhandar</p>
          </div>
          <div>
            <p className="text-sm font-medium">Trade enquiries</p>
            <p className="text-muted">
              Use the{' '}
              <Link href="/enquiry" className="underline underline-offset-2 hover:text-foreground">
                enquiry form
              </Link>{' '}
              (coming with the CRM). Until then, browse the catalogue and note the titles you need.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Hours</p>
            <p className="text-muted">Monday–Saturday, business hours (IST)</p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
