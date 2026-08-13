'use client';

import { SiteSettingsProvider, useSiteSettings } from '@/lib/site-settings';
import { PublicLangProvider } from '@/lib/public-lang';

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const settings = useSiteSettings();
  if (settings.features.maintenance_mode) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">We’ll be back shortly</h1>
          <p className="mt-3 text-muted">
            {settings.publisher.name} is undergoing scheduled maintenance.
          </p>
        </div>
      </div>
    );
  }
  return children;
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteSettingsProvider>
      <PublicLangProvider>
        <MaintenanceGate>{children}</MaintenanceGate>
      </PublicLangProvider>
    </SiteSettingsProvider>
  );
}
