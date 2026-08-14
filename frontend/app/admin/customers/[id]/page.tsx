'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CustomerDetailDto } from '@dsb/shared';
import { getCountry, nationalNumberFromE164 } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountrySelect, PhoneFields } from '@/components/ui/country-phone-fields';

export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    country: 'IN',
    phoneCountry: 'IN',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (!accessToken || !id) return;
    apiFetchWithToken<CustomerDetailDto>(`/admin/customers/${id}`, accessToken)
      .then((data) => {
        setCustomer(data);
        setForm({
          businessName: data.businessName,
          contactName: data.contactName,
          country: data.country,
          phoneCountry: data.phoneCountry,
          phone: nationalNumberFromE164(data.phone, data.phoneCountry),
          email: data.email ?? '',
        });
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load customer.')));
  }, [accessToken, id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !id) return;
    setError('');
    setSaving(true);
    try {
      const data = await apiFetchWithToken<CustomerDetailDto>(`/admin/customers/${id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          country: form.country,
          phoneCountry: form.phoneCountry,
          phone: form.phone,
          email: form.email || undefined,
        }),
      });
      setCustomer({ ...customer!, ...data, recentEnquiries: customer?.recentEnquiries ?? [], timeline: customer?.timeline ?? [] });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save customer.'));
    } finally {
      setSaving(false);
    }
  }

  if (error && !customer) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }
  if (!customer) return <p className="text-muted">Loading…</p>;

  const business = getCountry(customer.country);
  const phoneLoc = getCountry(customer.phoneCountry);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-muted hover:text-foreground">
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{customer.businessName}</h1>
        <p className="text-sm text-muted">
          {customer.customerNumber} · {customer.contactName} · {customer.phone}
        </p>
        <p className="text-sm text-muted">
          Location: {business ? `${business.flag} ${business.name}` : customer.country} · Phone country:{' '}
          {phoneLoc ? `${phoneLoc.flag} ${phoneLoc.name} +${phoneLoc.dialCode}` : customer.phoneCountry}
        </p>
        {customer.needsReview && (
          <p className="mt-2 text-sm text-amber-700">This record needs review (ambiguous match).</p>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-medium">Edit customer</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
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
              <Button type="submit" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Recent enquiries</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {customer.recentEnquiries.length === 0 && (
            <p className="text-sm text-muted">None yet.</p>
          )}
          {customer.recentEnquiries.map((e) => (
            <Link
              key={e.id}
              href={`/admin/enquiries/${e.id}`}
              className="block text-sm underline"
            >
              {e.enquiryNumber} — {e.subject}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Activity</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {customer.timeline.map((ev) => (
            <div key={ev.id} className="border-l-2 border-border pl-3 text-sm">
              <p className="font-medium">{ev.eventType}</p>
              <p className="text-muted">{new Date(ev.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
