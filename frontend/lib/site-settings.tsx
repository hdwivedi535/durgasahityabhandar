'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { PublicSiteSettings } from '@dsb/shared';
import { apiFetch } from '@/lib/api-client';

const FALLBACK: PublicSiteSettings = {
  publisher: { name: 'Durga Sahitya Bhandar' },
  features: {
    book_catalogue: true,
    enquiries: true,
    whatsapp: true,
    email: true,
    catalogue_download: false,
    pricing: true,
    public_tracking: true,
    maintenance_mode: false,
    crm_ai: false,
  },
  languages: [{ code: 'en', name: 'English', isDefault: true }],
};

const SiteSettingsContext = createContext<PublicSiteSettings>(FALLBACK);

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(FALLBACK);

  useEffect(() => {
    apiFetch<PublicSiteSettings>('/public/settings')
      .then(setSettings)
      .catch(() => setSettings(FALLBACK));
  }, []);

  return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
