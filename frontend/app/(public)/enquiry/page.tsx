'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { PublicEnquiryResult } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { useSiteSettings } from '@/lib/site-settings';

export default function EnquiryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col">
          <PublicHeader />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
            <p className="text-muted">Loading…</p>
          </main>
          <PublicFooter />
        </div>
      }
    >
      <EnquiryForm />
    </Suspense>
  );
}

function EnquiryForm() {
  const searchParams = useSearchParams();
  const settings = useSiteSettings();
  const bookId = searchParams.get('bookId') ?? '';
  const bookTitle = searchParams.get('title') ?? '';

  const [contactName, setContactName] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('IN');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(
    bookTitle ? `I am interested in: ${bookTitle}` : '',
  );
  const [requirementText, setRequirementText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublicEnquiryResult | null>(null);

  useEffect(() => {
    if (bookTitle && !message) {
      setMessage(`I am interested in: ${bookTitle}`);
    }
  }, [bookTitle, message]);

  if (!settings.features.enquiries) {
    return (
      <div className="min-h-screen flex flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
          <h1 className="text-3xl font-semibold">Enquiries unavailable</h1>
          <p className="mt-3 text-muted">Enquiry submissions are currently disabled.</p>
        </main>
        <PublicFooter />
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch<PublicEnquiryResult>('/public/enquiries', {
        method: 'POST',
        body: JSON.stringify({
          contactName,
          company,
          country,
          phone,
          email: email || undefined,
          message,
          requirementText: requirementText || undefined,
          interestedBookIds: bookId ? [bookId] : undefined,
        }),
      });
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit enquiry.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold">Submit enquiry</h1>
        <p className="mt-3 text-muted">
          Request books, wholesale pricing, or catalogue information. This is not a checkout.
        </p>

        {result ? (
          <div className="mt-8 rounded-lg border border-border bg-white p-5">
            <p className="font-medium">Enquiry received</p>
            <p className="mt-2 text-sm">
              Reference: <span className="font-mono">{result.enquiryNumber}</span>
            </p>
            {result.needsReview && (
              <p className="mt-2 text-sm text-muted">
                Our team will review this enquiry before it is linked to an existing account.
              </p>
            )}
            <Link href="/books" className="mt-4 inline-block text-sm underline">
              Back to catalogue
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-border bg-white p-5">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <Input
              label="Contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
            />
            <Input
              label="Company / institution"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Country (ISO)"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={2}
                required
              />
              <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <Input
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {bookTitle && (
              <p className="text-sm text-muted">Interested title: {bookTitle}</p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="requirement" className="block text-sm font-medium">
                Quantity / requirement
              </label>
              <textarea
                id="requirement"
                className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={requirementText}
                onChange={(e) => setRequirementText(e.target.value)}
                placeholder="e.g. 50 copies, delivery to Lucknow"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="message" className="block text-sm font-medium">
                Message
              </label>
              <textarea
                id="message"
                className="min-h-28 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={submitting}>
              Submit enquiry
            </Button>
          </form>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
