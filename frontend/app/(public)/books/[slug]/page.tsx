'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { PublicBookDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { BookImageGallery } from '@/components/ui/book-image-gallery';
import { apiFetch, apiFetchWithToken } from '@/lib/api-client';
import { usePublicLang } from '@/lib/public-lang';
import { useSiteSettings } from '@/lib/site-settings';

export default function BookDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col">
          <PublicHeader />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
            <p className="text-muted">Loading…</p>
          </main>
          <PublicFooter />
        </div>
      }
    >
      <BookDetailInner />
    </Suspense>
  );
}

function BookDetailInner() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { lang } = usePublicLang();
  const settings = useSiteSettings();
  const preview = searchParams.get('preview') === 'true';
  const [book, setBook] = useState<PublicBookDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    const query = `?lang=${lang}${preview ? '&preview=true' : ''}`;
    const token = preview ? localStorage.getItem('dsb_access_token') : null;
    const request = token
      ? apiFetchWithToken<PublicBookDto>(`/public/books/${params.slug}${query}`, token)
      : apiFetch<PublicBookDto>(`/public/books/${params.slug}${query}`);
    request
      .then(setBook)
      .catch(() => setBook(null))
      .finally(() => setLoading(false));
  }, [params.slug, lang, preview]);

  const translation =
    book?.translations.find((t) => t.languageCode === lang) ??
    book?.translations.find((t) => t.languageCode === 'en') ??
    book?.translations[0];

  const hasSpecs = Boolean(
    book &&
      (book.physical.pages ||
        book.pageTypeName ||
        book.physical.gsm ||
        book.physical.weightGrams ||
        book.physical.lengthMm ||
        book.publishing.isbn ||
        book.publishing.edition ||
        book.publishing.publicationYear ||
        book.publishing.publisher ||
        book.availabilityName ||
        (book.commercial.mrp != null && book.priceVisibility.showMrp) ||
        (book.commercial.wholesalePrice != null && book.priceVisibility.showWholesale) ||
        (book.commercial.moq != null && book.priceVisibility.showMoq)),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <Link href="/books" className="text-sm text-muted hover:text-foreground">
          ← All Books
        </Link>

        {preview && (
          <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted">
            Preview mode — this title may not be public yet.
          </p>
        )}

        {loading && <p className="mt-6 text-muted">Loading…</p>}

        {!loading && !book && <p className="mt-6 text-muted">Book not found.</p>}

        {book && (
          <>
            <h1 className="mt-4 text-3xl font-semibold">{book.displayTitle}</h1>
            {translation?.author && <p className="mt-2 text-muted">by {translation.author}</p>}
            {translation?.translator && (
              <p className="mt-1 text-sm text-muted">Translator: {translation.translator}</p>
            )}

            {book.imageUrls?.length > 0 && (
              <div className="mt-8">
                <BookImageGallery images={book.imageUrls} alt={book.displayTitle} />
              </div>
            )}

            {translation?.shortDescription && (
              <p className="mt-6 text-lg text-muted">{translation.shortDescription}</p>
            )}

            {translation?.detailedDescription && (
              <section className="mt-8">
                <h2 className="text-lg font-medium">About this book</h2>
                <p className="mt-3 whitespace-pre-wrap text-muted">
                  {translation.detailedDescription}
                </p>
              </section>
            )}

            {hasSpecs && (
            <section className="mt-8 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2">
              {book.physical.pages && (
                <div>
                  <p className="text-sm font-medium">Pages</p>
                  <p className="text-muted">{book.physical.pages}</p>
                </div>
              )}
              {book.pageTypeName && (
                <div>
                  <p className="text-sm font-medium">Page type</p>
                  <p className="text-muted">{book.pageTypeName}</p>
                </div>
              )}
              {book.physical.gsm && (
                <div>
                  <p className="text-sm font-medium">GSM</p>
                  <p className="text-muted">{book.physical.gsm}</p>
                </div>
              )}
              {book.physical.weightGrams && (
                <div>
                  <p className="text-sm font-medium">Weight</p>
                  <p className="text-muted">{book.physical.weightGrams} g</p>
                </div>
              )}
              {book.physical.lengthMm && book.physical.widthMm && (
                <div>
                  <p className="text-sm font-medium">Dimensions</p>
                  <p className="text-muted">
                    {book.physical.lengthMm} × {book.physical.widthMm}
                    {book.physical.heightMm ? ` × ${book.physical.heightMm}` : ''} mm
                  </p>
                </div>
              )}
              {book.bindingTypeName && (
                <div>
                  <p className="text-sm font-medium">Binding</p>
                  <p className="text-muted">{book.bindingTypeName}</p>
                </div>
              )}
              {book.availabilityName && (
                <div>
                  <p className="text-sm font-medium">Availability</p>
                  <p className="text-muted">{book.availabilityName}</p>
                </div>
              )}
              {book.publishing.isbn && (
                <div>
                  <p className="text-sm font-medium">ISBN</p>
                  <p className="text-muted">{book.publishing.isbn}</p>
                </div>
              )}
              {book.publishing.edition && (
                <div>
                  <p className="text-sm font-medium">Edition</p>
                  <p className="text-muted">{book.publishing.edition}</p>
                </div>
              )}
              {book.publishing.publicationYear && (
                <div>
                  <p className="text-sm font-medium">Publication year</p>
                  <p className="text-muted">{book.publishing.publicationYear}</p>
                </div>
              )}
              {book.publishing.publisher && (
                <div>
                  <p className="text-sm font-medium">Publisher</p>
                  <p className="text-muted">{book.publishing.publisher}</p>
                </div>
              )}
              {book.commercial.mrp != null && book.priceVisibility.showMrp && (
                <div>
                  <p className="text-sm font-medium">MRP</p>
                  <p className="text-muted">₹{book.commercial.mrp}</p>
                </div>
              )}
              {book.commercial.wholesalePrice != null && book.priceVisibility.showWholesale && (
                <div>
                  <p className="text-sm font-medium">Wholesale price</p>
                  <p className="text-muted">₹{book.commercial.wholesalePrice}</p>
                </div>
              )}
              {book.commercial.moq != null && book.priceVisibility.showMoq && (
                <div>
                  <p className="text-sm font-medium">Minimum order quantity</p>
                  <p className="text-muted">{book.commercial.moq}</p>
                </div>
              )}
            </section>
            )}

            {settings.features.enquiries && (
              <div className="mt-8">
                <Link
                  href="/enquiry"
                  className="inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Send enquiry
                </Link>
              </div>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
