'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { BookDto, BookPublishStatus } from '@dsb/shared';
import { apiFetchWithToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sa', label: 'Sanskrit' },
  { code: 'ne', label: 'Nepali' },
];

interface CategoryOption {
  id: string;
  label: string;
}

interface BookFormProps {
  accessToken: string;
  book?: BookDto | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function BookForm({ accessToken, book, onSuccess, onCancel }: BookFormProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [sku, setSku] = useState(book?.sku ?? '');
  const [publishStatus, setPublishStatus] = useState<BookPublishStatus>(
    book?.publishStatus ?? 'draft',
  );
  const [isFeatured, setIsFeatured] = useState(book?.isFeatured ?? false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(book?.categoryIds ?? []);
  const [titles, setTitles] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const lang of LANGUAGES) {
      initial[lang.code] =
        book?.translations.find((t) => t.languageCode === lang.code)?.title ?? '';
    }
    return initial;
  });
  const [slugs, setSlugs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const lang of LANGUAGES) {
      initial[lang.code] =
        book?.translations.find((t) => t.languageCode === lang.code)?.slug ?? '';
    }
    return initial;
  });
  const [authors, setAuthors] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const lang of LANGUAGES) {
      initial[lang.code] =
        book?.translations.find((t) => t.languageCode === lang.code)?.author ?? '';
    }
    return initial;
  });
  const [shortDescriptions, setShortDescriptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const lang of LANGUAGES) {
      initial[lang.code] =
        book?.translations.find((t) => t.languageCode === lang.code)?.shortDescription ?? '';
    }
    return initial;
  });
  const [pages, setPages] = useState(book?.physical.pages?.toString() ?? '');
  const [isbn, setIsbn] = useState(book?.publishing.isbn ?? '');
  const [mrp, setMrp] = useState(book?.commercial.mrp?.toString() ?? '');
  const [wholesalePrice, setWholesalePrice] = useState(
    book?.commercial.wholesalePrice?.toString() ?? '',
  );
  const [moq, setMoq] = useState(book?.commercial.moq?.toString() ?? '1');
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    const existing = book?.imageUrls?.filter(Boolean) ?? [];
    return [existing[0] ?? '', existing[1] ?? '', existing[2] ?? ''];
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetchWithToken<Array<{ id: string; translations: Array<{ languageCode: string; name: string }> }>>(
      '/admin/categories',
      accessToken,
    )
      .then((data) => {
        setCategories(
          data.map((category) => ({
            id: category.id,
            label:
              category.translations.find((t) => t.languageCode === 'en')?.name ??
              category.translations[0]?.name ??
              category.id,
          })),
        );
      })
      .catch(() => setCategories([]));
  }, [accessToken]);

  function handleTitleChange(code: string, value: string) {
    setTitles({ ...titles, [code]: value });
    if (!book && code === 'en' && !slugs.en) {
      setSlugs({ ...slugs, en: slugify(value) });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const translations = LANGUAGES.filter((l) => titles[l.code]?.trim()).map((l) => ({
      languageCode: l.code,
      title: titles[l.code].trim(),
      slug: (slugs[l.code] || slugify(titles[l.code])).trim().toLowerCase(),
      author: authors[l.code]?.trim() || undefined,
      shortDescription: shortDescriptions[l.code]?.trim() || undefined,
    }));

    if (translations.length === 0) {
      setError('At least one book title is required');
      setSubmitting(false);
      return;
    }

    const cleanedImages = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, 3);

    if (publishStatus === 'published' && cleanedImages.length < 1) {
      setError('Published books require Image 1 (cover URL)');
      setSubmitting(false);
      return;
    }

    const body = {
      sku: sku.trim() || undefined,
      categoryIds: selectedCategories,
      publishStatus,
      isFeatured,
      physical: pages ? { pages: Number(pages) } : undefined,
      publishing: isbn.trim() ? { isbn: isbn.trim() } : undefined,
      commercial: {
        mrp: mrp ? Number(mrp) : undefined,
        wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
        moq: moq ? Number(moq) : undefined,
        currency: 'INR',
      },
      imageUrls: cleanedImages,
      translations,
    };

    try {
      if (book) {
        await apiFetchWithToken(`/admin/books/${book.id}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetchWithToken('/admin/books', accessToken, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="SKU (optional)"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        placeholder="DSB-001"
      />

      {LANGUAGES.map((lang) => (
        <div key={lang.code} className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">{lang.label}</p>
          <Input
            label="Title"
            value={titles[lang.code]}
            onChange={(e) => handleTitleChange(lang.code, e.target.value)}
            placeholder={`Title in ${lang.label}`}
          />
          <Input
            label="Slug"
            value={slugs[lang.code]}
            onChange={(e) => setSlugs({ ...slugs, [lang.code]: e.target.value })}
            placeholder="book-slug"
          />
          <Input
            label="Author"
            value={authors[lang.code]}
            onChange={(e) => setAuthors({ ...authors, [lang.code]: e.target.value })}
          />
          <Input
            label="Short description"
            value={shortDescriptions[lang.code]}
            onChange={(e) =>
              setShortDescriptions({ ...shortDescriptions, [lang.code]: e.target.value })
            }
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <label htmlFor="categories" className="block text-sm font-medium">
          Categories
        </label>
        <select
          id="categories"
          multiple
          value={selectedCategories}
          onChange={(e) =>
            setSelectedCategories(Array.from(e.target.selectedOptions, (option) => option.value))
          }
          className="min-h-28 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Pages"
          type="number"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
        />
        <Input label="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <Input label="MRP (₹)" type="number" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        <Input
          label="Wholesale price (₹)"
          type="number"
          value={wholesalePrice}
          onChange={(e) => setWholesalePrice(e.target.value)}
        />
        <Input label="MOQ" type="number" value={moq} onChange={(e) => setMoq(e.target.value)} />
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Images (URL) — max 3</p>
        <p className="text-xs text-muted">
          Image 1 is the cover (required for published books). Image 2 and 3 are optional.
        </p>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                label={`Image ${index + 1} URL${index === 0 ? ' (cover)' : ''}`}
                value={imageUrls[index]}
                onChange={(e) => {
                  const next = [...imageUrls];
                  next[index] = e.target.value;
                  setImageUrls(next);
                }}
                placeholder="https://example.com/book.jpg"
              />
            </div>
            {imageUrls[index] && (
              <div className="mt-6 flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrls[index]}
                  alt={`Preview ${index + 1}`}
                  className="h-14 w-14 rounded border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = [...imageUrls];
                    next[index] = '';
                    setImageUrls(next);
                  }}
                >
                  Remove
                </Button>
                {index > 0 && imageUrls[index] && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = [...imageUrls];
                      const tmp = next[index - 1];
                      next[index - 1] = next[index];
                      next[index] = tmp;
                      setImageUrls(next);
                    }}
                  >
                    Move up
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="publishStatus" className="block text-sm font-medium">
          Status
        </label>
        <select
          id="publishStatus"
          value={publishStatus}
          onChange={(e) => setPublishStatus(e.target.value as BookPublishStatus)}
          className="flex h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="preview">Preview</option>
          <option value="published">Published</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        Featured book
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          {book ? 'Save Changes' : 'Create Book'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
