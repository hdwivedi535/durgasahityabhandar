import type { PublicBookDto } from '@dsb/shared';

export function applyPublicBookVisibility(
  book: PublicBookDto,
  options: { pricingEnabled: boolean },
): PublicBookDto {
  const vis = book.fieldVisibility ?? {};
  const next: PublicBookDto = {
    ...book,
    translations: book.translations.map((t) => ({ ...t })),
    physical: { ...book.physical },
    publishing: { ...book.publishing },
    commercial: { ...book.commercial },
    priceVisibility: { ...book.priceVisibility },
  };

  if (vis.physical === false) {
    next.physical = {};
    next.pageTypeName = undefined;
    next.bindingTypeName = undefined;
  }
  if (vis.publishing === false) {
    next.publishing = {};
  }
  if (vis.commercial === false || !options.pricingEnabled) {
    next.commercial = { currency: book.commercial?.currency ?? 'INR' };
    next.priceVisibility = { showMrp: false, showWholesale: false, showMoq: false };
  }
  if (vis.author === false) {
    next.displayAuthor = undefined;
    next.translations = next.translations.map((t) => ({ ...t, author: undefined }));
  }
  if (vis.translator === false) {
    next.translations = next.translations.map((t) => ({ ...t, translator: undefined }));
  }

  return next;
}
