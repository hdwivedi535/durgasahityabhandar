export type LookupKind = 'pageType' | 'bindingType' | 'subject' | 'tag' | 'availability';

export interface LookupDto {
  id: string;
  kind: LookupKind;
  slug: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const LOOKUP_KINDS: LookupKind[] = [
  'pageType',
  'bindingType',
  'subject',
  'tag',
  'availability',
];

export const LOOKUP_KIND_LABELS: Record<LookupKind, string> = {
  pageType: 'Page types',
  bindingType: 'Binding types',
  subject: 'Subjects',
  tag: 'Tags',
  availability: 'Availability',
};
