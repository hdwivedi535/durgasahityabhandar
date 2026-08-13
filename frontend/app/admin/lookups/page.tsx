'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { LookupDto, LookupKind } from '@dsb/shared';
import { LOOKUP_KIND_LABELS, LOOKUP_KINDS } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function AdminLookupsPage() {
  const { accessToken } = useAuth();
  const [kind, setKind] = useState<LookupKind>('pageType');
  const [items, setItems] = useState<LookupDto[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    const data = await apiFetchWithToken<LookupDto[]>(`/admin/lookups?kind=${kind}`, accessToken);
    setItems(data);
  }

  useEffect(() => {
    load().catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, kind]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError('');
    try {
      await apiFetchWithToken('/admin/lookups', accessToken, {
        method: 'POST',
        body: JSON.stringify({ kind, name, slug: slug || slugify(name) }),
      });
      setName('');
      setSlug('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function toggleActive(item: LookupDto) {
    if (!accessToken) return;
    await apiFetchWithToken(`/admin/lookups/${item.id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await load();
  }

  async function remove(item: LookupDto) {
    if (!accessToken) return;
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await apiFetchWithToken(`/admin/lookups/${item.id}`, accessToken, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lookups</h1>
        <p className="mt-1 text-sm text-muted">
          Page types, binding types, subjects, tags, and availability used on books.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LOOKUP_KINDS.map((item) => (
          <Button
            key={item}
            type="button"
            variant={kind === item ? 'primary' : 'secondary'}
            onClick={() => setKind(item)}
          >
            {LOOKUP_KIND_LABELS[item]}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Add {LOOKUP_KIND_LABELS[kind].toLowerCase()}</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugify(name)}
            />
            <Button type="submit">Add</Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">{LOOKUP_KIND_LABELS[kind]}</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted">None yet.</p>}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.slug} · {item.isActive ? 'active' : 'inactive'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => toggleActive(item)}>
                  {item.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => remove(item)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
