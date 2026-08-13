import type { FeatureToggleDto, FeatureToggleKey, PublicSiteSettings } from '@dsb/shared';
import { FEATURE_TOGGLE_KEYS } from '@dsb/shared';
import { FeatureToggle } from '../models/feature-toggle.model';
import { ensureDefaultLookups } from './lookup.service';
import { ensureCmsDefaults } from './cms.service';

const DEFAULTS: FeatureToggleDto[] = [
  { key: 'book_catalogue', enabled: true, description: 'Public book catalogue' },
  { key: 'enquiries', enabled: true, description: 'Enquiry pages and CTAs' },
  { key: 'whatsapp', enabled: true, description: 'WhatsApp contact CTAs' },
  { key: 'email', enabled: true, description: 'Transactional email (CRM)' },
  { key: 'catalogue_download', enabled: false, description: 'Catalogue download button' },
  { key: 'pricing', enabled: true, description: 'Show book pricing when field visibility allows' },
  { key: 'public_tracking', enabled: true, description: 'Public enquiry tracking page' },
  { key: 'maintenance_mode', enabled: false, description: 'Show maintenance page on public site' },
];

export async function ensureFeatureToggles(): Promise<void> {
  for (const item of DEFAULTS) {
    await FeatureToggle.findOneAndUpdate(
      { key: item.key },
      { $setOnInsert: { enabled: item.enabled, description: item.description } },
      { upsert: true },
    );
  }
}

export async function listFeatureToggles(): Promise<FeatureToggleDto[]> {
  await ensureFeatureToggles();
  const docs = await FeatureToggle.find({ key: { $in: [...FEATURE_TOGGLE_KEYS] } });
  const byKey = new Map(docs.map((d) => [d.key, d]));
  return DEFAULTS.map((d) => {
    const found = byKey.get(d.key);
    return {
      key: d.key,
      enabled: found?.enabled ?? d.enabled,
      description: found?.description || d.description,
    };
  });
}

export async function updateFeatureToggle(
  key: FeatureToggleKey,
  enabled: boolean,
): Promise<FeatureToggleDto> {
  await ensureFeatureToggles();
  const doc = await FeatureToggle.findOneAndUpdate(
    { key },
    { enabled },
    { new: true },
  );
  if (!doc) {
    throw new Error(`Unknown feature toggle: ${key}`);
  }
  return { key: doc.key, enabled: doc.enabled, description: doc.description };
}

export async function getFeatureMap(): Promise<Record<FeatureToggleKey, boolean>> {
  const items = await listFeatureToggles();
  return Object.fromEntries(items.map((i) => [i.key, i.enabled])) as Record<
    FeatureToggleKey,
    boolean
  >;
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  await Promise.all([ensureFeatureToggles(), ensureDefaultLookups(), ensureCmsDefaults()]);
  const features = await getFeatureMap();
  return {
    publisher: { name: 'Durga Sahitya Bhandar' },
    features,
    languages: [
      { code: 'en', name: 'English', isDefault: true },
      { code: 'hi', name: 'Hindi' },
      { code: 'sa', name: 'Sanskrit' },
      { code: 'ne', name: 'Nepali' },
    ],
  };
}
