'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { CustomerDto, CustomerListResult } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CountrySelect, PhoneFields } from '@/components/ui/country-phone-fields';

export default function AdminCustomersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CustomerDto[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    phone: '',
    phoneCountry: 'IN',
    country: 'IN',
    email: '',
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (needsReview) params.set('needsReview', 'true');
      const data = await apiFetchWithToken<CustomerListResult>(
        `/admin/customers?${params}`,
        accessToken,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load customers.'));
    }
  }, [accessToken, q, needsReview]);

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Failed to load customers.')));
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError('');
    try {
      await apiFetchWithToken('/admin/customers', accessToken, {
        method: 'POST',
        body: JSON.stringify({ ...form, email: form.email || undefined }),
      });
      setShowCreate(false);
      setForm({ businessName: '', contactName: '', phone: '', phoneCountry: 'IN', country: 'IN', email: '' });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create customer.'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-muted">{total} records</p>
        </div>
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New customer'}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
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
          <CardHeader>
            <h2 className="font-medium">Create customer</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Company"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                required
              />
              <Input
                label="Contact"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                required
              />
              <CountrySelect
                label="Business / location country"
                value={form.country}
                onChange={(country) => setForm({ ...form, country })}
                required
              />
              <PhoneFields
                phoneCountry={form.phoneCountry}
                nationalNumber={form.phone}
                onPhoneCountryChange={(phoneCountry) => setForm({ ...form, phoneCountry })}
                onNationalNumberChange={(phone) => setForm({ ...form, phone })}
                required
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <div className="flex items-end">
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 pt-5">
          {items.length === 0 && <p className="text-sm text-muted">No customers yet.</p>}
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customers/${c.id}`}
              className="block rounded-lg border border-border px-4 py-3 hover:bg-accent"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {c.businessName}{' '}
                  <span className="text-sm font-normal text-muted">{c.customerNumber}</span>
                </p>
                {c.needsReview && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    Needs review
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">
                {c.contactName} · {c.phone} · {c.country} / phone {c.phoneCountry}
              </p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
