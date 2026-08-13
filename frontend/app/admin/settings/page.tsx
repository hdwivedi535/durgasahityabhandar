'use client';

import { useEffect, useState } from 'react';
import type { FeatureToggleDto } from '@dsb/shared';
import { useAuth } from '@/lib/auth-context';
import { apiFetchWithToken } from '@/lib/api-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function AdminSettingsPage() {
  const { accessToken } = useAuth();
  const [toggles, setToggles] = useState<FeatureToggleDto[]>([]);
  const [error, setError] = useState('');

  async function load() {
    if (!accessToken) return;
    const data = await apiFetchWithToken<FeatureToggleDto[]>('/admin/features', accessToken);
    setToggles(data);
  }

  useEffect(() => {
    load().catch(() => setError('Failed to load settings'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function toggle(item: FeatureToggleDto) {
    if (!accessToken) return;
    await apiFetchWithToken(`/admin/features/${item.key}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Public feature toggles take effect immediately.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-medium">Feature toggles</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {toggles.map((item) => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
            >
              <span>
                <span className="block font-medium">{item.key.replace(/_/g, ' ')}</span>
                <span className="text-sm text-muted">{item.description}</span>
              </span>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggle(item)}
                className="mt-1"
              />
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
