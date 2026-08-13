'use client';

import { FormEvent, useState } from 'react';
import type { CategoryDto, CategoryStatus } from '@dsb/shared';
import { apiFetchWithToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sa', label: 'Sanskrit' },
  { code: 'ne', label: 'Nepali' },
];

interface CategoryFormProps {
  accessToken: string;
  category?: CategoryDto | null;
  parentId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({
  accessToken,
  category,
  parentId,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [status, setStatus] = useState<CategoryStatus>(category?.status ?? 'draft');
  const [isFeatured, setIsFeatured] = useState(category?.isFeatured ?? false);
  const [names, setNames] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const lang of LANGUAGES) {
      initial[lang.code] =
        category?.translations.find((t) => t.languageCode === lang.code)?.name ?? '';
    }
    return initial;
  });
  const [seoTitle, setSeoTitle] = useState(category?.seo.title ?? '');
  const [seoDescription, setSeoDescription] = useState(category?.seo.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const translations = LANGUAGES.filter((l) => names[l.code]?.trim()).map((l) => ({
      languageCode: l.code,
      name: names[l.code].trim(),
    }));

    if (translations.length === 0) {
      setError('At least one category name is required');
      setSubmitting(false);
      return;
    }

    const body = {
      parentId: parentId ?? null,
      slug: slug.trim().toLowerCase(),
      status,
      isFeatured,
      translations,
      seo: {
        title: seoTitle || undefined,
        description: seoDescription || undefined,
        indexable: true,
      },
    };

    try {
      if (category) {
        await apiFetchWithToken(`/admin/categories/${category.id}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetchWithToken('/admin/categories', accessToken, {
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
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="bhagavad-gita"
        required
      />

      {LANGUAGES.map((lang) => (
        <Input
          key={lang.code}
          label={`Name (${lang.label})`}
          value={names[lang.code]}
          onChange={(e) => setNames({ ...names, [lang.code]: e.target.value })}
          placeholder={lang.label}
        />
      ))}

      <div className="space-y-1.5">
        <label htmlFor="status" className="block text-sm font-medium">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CategoryStatus)}
          className="flex h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
        />
        Featured category
      </label>

      <Input
        label="SEO Title"
        value={seoTitle}
        onChange={(e) => setSeoTitle(e.target.value)}
      />
      <Input
        label="SEO Description"
        value={seoDescription}
        onChange={(e) => setSeoDescription(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          {category ? 'Save Changes' : 'Create Category'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
