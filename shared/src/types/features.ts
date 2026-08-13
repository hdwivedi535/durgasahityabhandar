export const FEATURE_TOGGLE_KEYS = [
  'book_catalogue',
  'enquiries',
  'whatsapp',
  'email',
  'catalogue_download',
  'pricing',
  'public_tracking',
  'maintenance_mode',
] as const;

export type FeatureToggleKey = (typeof FEATURE_TOGGLE_KEYS)[number];

export interface FeatureToggleDto {
  key: FeatureToggleKey;
  enabled: boolean;
  description: string;
}

export interface PublicSiteSettings {
  publisher: { name: string };
  features: Record<FeatureToggleKey, boolean>;
  languages: Array<{ code: string; name: string; isDefault?: boolean }>;
}
