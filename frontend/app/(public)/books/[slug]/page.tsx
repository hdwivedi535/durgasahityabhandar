'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { PublicBookDto } from '@dsb/shared';
import { PublicFooter, PublicHeader } from '@/components/public/public-header';
import { BookImageGallery } from '@/components/ui/book-image-gallery';
import { apiFetch } from '@/lib/api-client';

export default function BookDetailPage() {
  const params = useParams<{ slug: string }>();
  const [book, setBook] = useState<PublicBookDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.slug) return;
    apiFetch<PublicBookDto>(`/public/books/${params.slug}?lang=en`)
      .then(setBook)
      .catch(() => setBook(null))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const translation =
    book?.translations.find((t) => t.languageCode === 'en') ?? book?.translations[0];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <Link href="/books" className="text-sm text-muted hover:text-foreground">
          ← All Books
        </Link>

        {loading && <p className="mt-6 text-muted">Loading…</p>}

        {!loading && !book && <p className="mt-6 text-muted">Book not found.</p>}

        {book && (
          <>
            <h1 className="mt-4 text-3xl font-semibold">{book.displayTitle}</h1>
            {translation?.author && (
              <p className="mt-2 text-muted">by {translation.author}</p>
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

            <section className="mt-8 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2">
              {book.physical.pages && (
                <div>
                  <p className="text-sm font-medium">Pages</p>
                  <p className="text-muted">{book.physical.pages}</p>
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

            <div className="mt-8">
              <Link
                href="/enquiry"
                className="inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Send enquiry
              </Link>
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
