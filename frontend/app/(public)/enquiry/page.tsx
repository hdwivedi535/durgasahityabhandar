import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { Button } from '@/components/ui/button';

export default function EnquiryPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Submit enquiry</h1>
        <p className="mt-3 text-muted">
          Request books, wholesale pricing, or catalogue information for your institution or
          business. This is not an e-commerce checkout.
        </p>

        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-5 text-sm text-muted">
          The enquiry form and customer matching will ship with the CRM (Phase 4). For now, browse
          titles and note SKUs or book names before you contact us.
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/books">
            <Button>Browse catalogue</Button>
          </Link>
          <Link href="/wholesale">
            <Button variant="secondary">Wholesale process</Button>
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
