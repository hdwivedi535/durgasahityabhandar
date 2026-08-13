'use client';

import { useEffect, useState } from 'react';
import type { CmsPageDto, HomepageSectionDto } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AdminWebsitePage() {
  const { accessToken } = useAuth();
  const [pages, setPages] = useState<CmsPageDto[]>([]);
  const [sections, setSections] = useState<HomepageSectionDto[]>([]);
  const [editingPage, setEditingPage] = useState<CmsPageDto | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageBody, setPageBody] = useState('');
  const [pageStatus, setPageStatus] = useState<'draft' | 'published' | 'hidden'>('published');

  async function load() {
    if (!accessToken) return;
    const [p, s] = await Promise.all([
      apiFetchWithToken<CmsPageDto[]>('/admin/website/pages', accessToken),
      apiFetchWithToken<HomepageSectionDto[]>('/admin/website/homepage', accessToken),
    ]);
    setPages(p);
    setSections(s);
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function startEdit(page: CmsPageDto) {
    const en = page.translations.find((t) => t.languageCode === 'en') ?? page.translations[0];
    setEditingPage(page);
    setPageTitle(en?.title ?? '');
    setPageBody(en?.body ?? '');
    setPageStatus(page.status);
  }

  async function savePage() {
    if (!accessToken || !editingPage) return;
    await apiFetchWithToken(`/admin/website/pages/${editingPage.id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        status: pageStatus,
        isVisible: pageStatus === 'published',
        translations: [{ languageCode: 'en', title: pageTitle, body: pageBody }],
      }),
    });
    setEditingPage(null);
    await load();
  }

  async function saveSection(section: HomepageSectionDto, patch: Partial<HomepageSectionDto> & { config?: Record<string, unknown> }) {
    if (!accessToken) return;
    await apiFetchWithToken(`/admin/website/homepage/${section.id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function move(section: HomepageSectionDto, direction: -1 | 1) {
    if (!accessToken) return;
    const index = sections.findIndex((s) => s.id === section.id);
    const swap = sections[index + direction];
    if (!swap) return;
    await apiFetchWithToken('/admin/website/homepage/reorder', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        items: [
          { id: section.id, sortOrder: swap.sortOrder },
          { id: swap.id, sortOrder: section.sortOrder },
        ],
      }),
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Website</h1>
        <p className="mt-1 text-sm text-muted">Edit public pages and homepage sections.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Pages</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">/{page.slug}</p>
                <p className="text-sm text-muted">{page.status}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => startEdit(page)}>
                Edit
              </Button>
            </div>
          ))}

          {editingPage && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="font-medium">Edit /{editingPage.slug}</p>
              <Input label="Title" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} />
              <div className="space-y-1.5">
                <label htmlFor="page-body" className="block text-sm font-medium">
                  Body
                </label>
                <textarea
                  id="page-body"
                  value={pageBody}
                  onChange={(e) => setPageBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <select
                value={pageStatus}
                onChange={(e) => setPageStatus(e.target.value as typeof pageStatus)}
                className="h-10 rounded-lg border border-border px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
              <div className="flex gap-2">
                <Button type="button" onClick={savePage}>
                  Save page
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditingPage(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Homepage sections</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section) => (
            <div key={section.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{section.type.replace('_', ' ')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => move(section, -1)}>
                    Up
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => move(section, 1)}>
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      saveSection(section, {
                        publishStatus: section.publishStatus === 'published' ? 'draft' : 'published',
                      })
                    }
                  >
                    {section.publishStatus === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => saveSection(section, { isVisible: !section.isVisible })}
                  >
                    {section.isVisible ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
              {section.type === 'hero' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Headline"
                    defaultValue={String(section.config.headline ?? '')}
                    onBlur={(e) => saveSection(section, { config: { headline: e.target.value } })}
                  />
                  <Input
                    label="Subhead"
                    defaultValue={String(section.config.subhead ?? '')}
                    onBlur={(e) => saveSection(section, { config: { subhead: e.target.value } })}
                  />
                </div>
              )}
              {section.type === 'custom_content' && (
                <Input
                  label="Body"
                  defaultValue={String(section.config.body ?? '')}
                  onBlur={(e) => saveSection(section, { config: { body: e.target.value } })}
                />
              )}
              <p className="text-xs text-muted">
                {section.publishStatus} · {section.isVisible ? 'visible' : 'hidden'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
