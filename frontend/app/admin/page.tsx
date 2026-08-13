'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface DashboardData {
  message: string;
  user: string;
  modules: string[];
}

export default function AdminDashboardPage() {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    apiFetchWithToken<DashboardData>('/admin/dashboard', accessToken)
      .then(setData)
      .catch(() => setError('Unable to load dashboard'));
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted">CRM overview — Phase 2 foundation</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['New', 'Open', 'Pending', 'Unassigned'].map((label) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 text-3xl font-semibold">—</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium">API Connection</h2>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600">{error}</p>}
          {data && (
            <div className="space-y-2 text-sm">
              <p>{data.message}</p>
              <p>
                <span className="text-muted">Modules: </span>
                {data.modules.join(', ')}
              </p>
            </div>
          )}
          {!data && !error && <p className="text-muted">Loading…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">Your Access</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">Roles: {user?.roleSlugs.join(', ')}</p>
          <p className="mt-2 text-sm text-muted">Scope: {user?.accessScope}</p>
        </CardContent>
      </Card>
    </div>
  );
}
