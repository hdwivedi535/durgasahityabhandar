'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CustomerDetailDto } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken || !id) return;
    apiFetchWithToken<CustomerDetailDto>(`/admin/customers/${id}`, accessToken)
      .then(setCustomer)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load customer.')));
  }, [accessToken, id]);

  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }
  if (!customer) return <p className="text-muted">Loading…</p>;

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
        {customer.needsReview && (
          <p className="mt-2 text-sm text-amber-700">This record needs review (ambiguous match).</p>
        )}
      </div>

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
