'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { CrmConfigDto, EnquiryDto, EnquiryListResult } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AdminEnquiriesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<EnquiryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [statuses, setStatuses] = useState<CrmConfigDto[]>([]);
  const [q, setQ] = useState('');
  const [statusId, setStatusId] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    contactName: '',
    company: '',
    phone: '',
    country: 'IN',
    email: '',
    message: '',
    requirementText: '',
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusId) params.set('statusId', statusId);
      if (needsReview) params.set('needsReview', 'true');
      const data = await apiFetchWithToken<EnquiryListResult>(
        `/admin/enquiries?${params}`,
        accessToken,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load enquiries.'));
    }
  }, [accessToken, q, statusId, needsReview]);

  useEffect(() => {
    if (!accessToken) return;
    apiFetchWithToken<CrmConfigDto[]>('/admin/crm-config', accessToken)
      .then((rows) => setStatuses(rows.filter((r) => r.kind === 'enquiryStatus')))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load statuses.')));
  }, [accessToken]);

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Failed to load enquiries.')));
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError('');
    try {
      await apiFetchWithToken('/admin/enquiries', accessToken, {
        method: 'POST',
        body: JSON.stringify({ ...form, email: form.email || undefined }),
      });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create enquiry.'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Enquiries</h1>
          <p className="mt-1 text-sm text-muted">{total} in inbox</p>
        </div>
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New enquiry'}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Status</label>
          <select
            className="h-10 rounded-lg border border-border px-3 text-sm"
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
          >
            <option value="">All</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={needsReview}
            onChange={(e) => setNeedsReview(e.target.checked)}
          />
          Needs review
        </label>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Contact"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                required
              />
              <Input
                label="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                required
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              <Input
                label="Country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                required
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Requirement"
                value={form.requirementText}
                onChange={(e) => setForm({ ...form, requirementText: e.target.value })}
              />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">Message</label>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 pt-5">
          {items.length === 0 && <p className="text-sm text-muted">No enquiries yet.</p>}
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/enquiries/${item.id}`}
              className="block rounded-lg border border-border px-4 py-3 hover:bg-accent"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm">{item.enquiryNumber}</p>
                <p className="text-sm">{item.status?.name ?? '—'}</p>
              </div>
              <p className="text-sm">
                {item.company} · {item.contactName}
              </p>
              {item.needsReview && (
                <p className="text-xs text-amber-700">Needs review</p>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
