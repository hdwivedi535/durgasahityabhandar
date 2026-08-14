import { describe, expect, it } from 'vitest';
import {
  decideMatch,
  publicCreatePolicy,
  followMergedId,
  type MatchCandidate,
} from '../services/customer-match';

const a: MatchCandidate = {
  id: 'a',
  country: 'IN',
  phoneNormalized: '919876543210',
  emailNormalized: 'a@shop.com',
};
const b: MatchCandidate = {
  id: 'b',
  country: 'IN',
  phoneNormalized: '911112223333',
  emailNormalized: 'b@shop.com',
};

describe('decideMatch', () => {
  it('scores exact phone+country at 100 and auto-links', () => {
    const decision = decideMatch(
      { country: 'IN', phoneNormalized: '919876543210', emailNormalized: 'other@x.com' },
      [a, b],
    );
    expect(decision.kind).toBe('exact');
    if (decision.kind === 'exact') {
      expect(decision.match.customerId).toBe('a');
      expect(decision.match.score).toBe(100);
      expect(decision.match.reasons).toContain('phone');
    }
  });

  it('scores exact email at 80 when phone does not match', () => {
    const decision = decideMatch(
      { country: 'IN', phoneNormalized: '919999999999', emailNormalized: 'b@shop.com' },
      [a, b],
    );
    expect(decision.kind).toBe('exact');
    if (decision.kind === 'exact') {
      expect(decision.match.customerId).toBe('b');
      expect(decision.match.score).toBe(80);
      expect(decision.match.reasons).toEqual(['email']);
    }
  });

  it('is ambiguous when phone hits A and email hits B', () => {
    const decision = decideMatch(
      { country: 'IN', phoneNormalized: '919876543210', emailNormalized: 'b@shop.com' },
      [a, b],
    );
    expect(decision.kind).toBe('ambiguous');
    if (decision.kind === 'ambiguous') {
      const ids = decision.matches.map((m) => m.customerId).sort();
      expect(ids).toEqual(['a', 'b']);
    }
  });

  it('does not match across country', () => {
    const decision = decideMatch(
      { country: 'NP', phoneNormalized: '919876543210' },
      [a],
    );
    expect(decision.kind).toBe('none');
  });

  it('follows mergedIntoId to the survivor', () => {
    const loser: MatchCandidate = {
      ...a,
      id: 'loser',
      mergedIntoId: 'a',
    };
    const decision = decideMatch(
      { country: 'IN', phoneNormalized: '919876543210' },
      [loser, a],
    );
    expect(decision.kind).toBe('exact');
    if (decision.kind === 'exact') {
      expect(decision.match.customerId).toBe('a');
    }
  });
});

describe('publicCreatePolicy', () => {
  it('links exact, creates on none, and flags needsReview on ambiguous (never merge)', () => {
    expect(publicCreatePolicy({ kind: 'none' })).toBe('create');
    expect(
      publicCreatePolicy({
        kind: 'exact',
        match: { customerId: 'a', score: 100, reasons: ['phone'] },
      }),
    ).toBe('link');
    expect(
      publicCreatePolicy({
        kind: 'ambiguous',
        matches: [
          { customerId: 'a', score: 100, reasons: ['phone'] },
          { customerId: 'b', score: 80, reasons: ['email'] },
        ],
      }),
    ).toBe('create_needs_review');
  });
});

describe('followMergedId', () => {
  it('returns the id when there is no merge pointer', () => {
    const byId = new Map([['a', a]]);
    expect(followMergedId('a', byId)).toBe('a');
  });
});
