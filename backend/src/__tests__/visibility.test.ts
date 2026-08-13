import { describe, expect, it } from 'vitest';
import { applyPublicBookVisibility } from '../services/visibility.service';
import type { PublicBookDto } from '@dsb/shared';

const book: PublicBookDto = {
  id: '1',
  categoryIds: [],
  subjectIds: [],
  tagIds: [],
  physical: { pages: 100, gsm: 70 },
  publishing: { isbn: '123' },
  commercial: { mrp: 200, wholesalePrice: 120, moq: 5, currency: 'INR' },
  fieldVisibility: {
    physical: false,
    publishing: true,
    commercial: true,
    author: false,
    translator: true,
  },
  priceVisibility: { showMrp: true, showWholesale: true, showMoq: true },
  imageUrls: [],
  galleryMediaIds: [],
  isFeatured: false,
  publishStatus: 'published',
  translations: [{ languageCode: 'en', title: 'Gita', slug: 'gita', author: 'Vyasa' }],
  createdAt: '',
  updatedAt: '',
  displayTitle: 'Gita',
  displaySlug: 'gita',
  displayAuthor: 'Vyasa',
  pageTypeName: 'Maplitho',
};

describe('applyPublicBookVisibility', () => {
  it('hides physical specs and author when field visibility is off', () => {
    const result = applyPublicBookVisibility(book, { pricingEnabled: true });
    expect(result.physical).toEqual({});
    expect(result.pageTypeName).toBeUndefined();
    expect(result.displayAuthor).toBeUndefined();
    expect(result.translations[0].author).toBeUndefined();
    expect(result.publishing.isbn).toBe('123');
    expect(result.priceVisibility.showWholesale).toBe(true);
  });

  it('strips prices when the pricing feature is off', () => {
    const result = applyPublicBookVisibility(book, { pricingEnabled: false });
    expect(result.commercial.mrp).toBeUndefined();
    expect(result.priceVisibility.showMrp).toBe(false);
  });
});
