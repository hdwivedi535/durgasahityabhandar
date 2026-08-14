import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, FEATURE_TOGGLE_KEYS } from '@dsb/shared';
import { isRealProviderEnabled } from '../services/ai-config';
import { utcDateKey, wouldExceedBudget, estimateTokenCount } from '../services/ai-budget.service';

describe('Phase 5 foundation', () => {
  it('includes enquiries.generate_ai', () => {
    expect(ALL_PERMISSIONS).toContain('enquiries.generate_ai');
  });

  it('includes crm_ai feature key', () => {
    expect(FEATURE_TOGGLE_KEYS).toContain('crm_ai');
  });

  it('keeps real provider calls off until key and budget are set', () => {
    expect(
      isRealProviderEnabled({ provider: 'none', hasApiKey: false, dailyTokenBudget: 0 }),
    ).toBe(false);
    expect(
      isRealProviderEnabled({
        provider: 'openai_compatible',
        hasApiKey: true,
        dailyTokenBudget: 0,
      }),
    ).toBe(false);
    expect(
      isRealProviderEnabled({
        provider: 'openai_compatible',
        hasApiKey: false,
        dailyTokenBudget: 1000,
      }),
    ).toBe(false);
    expect(
      isRealProviderEnabled({
        provider: 'openai_compatible',
        hasApiKey: true,
        dailyTokenBudget: 1000,
      }),
    ).toBe(true);
  });

  it('treats a zero daily budget as blocking', () => {
    expect(wouldExceedBudget(0, 10, 0)).toBe(true);
    expect(wouldExceedBudget(90, 20, 100)).toBe(true);
    expect(wouldExceedBudget(50, 20, 100)).toBe(false);
    expect(utcDateKey(new Date('2026-08-14T12:00:00.000Z'))).toBe('2026-08-14');
    expect(estimateTokenCount('abcd')).toBe(1);
  });
});
