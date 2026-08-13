import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';

export default function TrackEnquiryPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Track enquiry</h1>
        <p className="mt-3 text-muted">
          After you submit an enquiry you will receive a reference number. Tracking lets you check
          status without seeing other customers’ data.
        </p>

        <div className="mt-8 rounded-lg border border-dashed border-border bg-white p-5 text-sm text-muted">
          Public tracking will be available once the enquiry CRM is live. Until then, please{' '}
          <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">
            contact us
          </Link>{' '}
          or{' '}
          <Link href="/enquiry" className="underline underline-offset-2 hover:text-foreground">
            send an enquiry
          </Link>
          .
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
