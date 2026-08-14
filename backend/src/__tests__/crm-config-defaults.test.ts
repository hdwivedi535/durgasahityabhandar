import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENQUIRY_PRIORITIES,
  DEFAULT_ENQUIRY_STATUSES,
} from '../services/crm-config.service';

describe('CRM seed defaults', () => {
  it('seeds the sales workflow statuses in order', () => {
    expect(DEFAULT_ENQUIRY_STATUSES.map((s) => s.slug)).toEqual([
      'new',
      'contacted',
      'follow-up-required',
      'quotation-sent',
      'negotiation',
      'won',
      'lost',
      'closed',
    ]);
    expect(DEFAULT_ENQUIRY_STATUSES.filter((s) => s.isTerminal).map((s) => s.slug)).toEqual([
      'won',
      'lost',
      'closed',
    ]);
    expect(DEFAULT_ENQUIRY_STATUSES.find((s) => s.slug === 'quotation-sent')?.isTerminal).toBe(
      false,
    );
  });

  it('seeds low/normal/high priorities', () => {
    expect(DEFAULT_ENQUIRY_PRIORITIES.map((p) => p.slug)).toEqual(['low', 'normal', 'high']);
  });
});
