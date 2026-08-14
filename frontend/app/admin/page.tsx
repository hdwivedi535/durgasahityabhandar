'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { EnquiryDashboardCounts } from '@dsb/shared';

interface DashboardData {
  message: string;
  user: string;
  modules: string[];
  counts?: EnquiryDashboardCounts;
}

export default function AdminDashboardPage() {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    apiFetchWithToken<DashboardData>('/admin/dashboard', accessToken)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, 'Unable to load dashboard')));
  }, [accessToken]);

  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted">Enquiry pipeline</p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(counts?.byStatus ?? []).slice(0, 6).map((row) => (
          <Card key={row.statusId}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted">{row.name}</p>
              <p className="mt-2 text-3xl font-semibold">{row.count}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted">Unassigned</p>
            <p className="mt-2 text-3xl font-semibold">{counts?.unassigned ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted">Needs review</p>
            <p className="mt-2 text-3xl font-semibold">{counts?.needsReview ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted">Follow-ups due</p>
            <p className="mt-2 text-3xl font-semibold">{counts?.followUpsDue ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Your access</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">Roles: {user?.roleSlugs.join(', ')}</p>
          <p className="mt-2 text-sm text-muted">Scope: {user?.accessScope}</p>
        </CardContent>
      </Card>
    </div>
  );
}
