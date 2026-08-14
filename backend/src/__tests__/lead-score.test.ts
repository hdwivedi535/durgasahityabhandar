import { describe, expect, it } from 'vitest';
import {
  LEAD_SCORE_BASE,
  LEAD_SCORE_LOW_MAX,
  LEAD_SCORE_NORMAL_MAX,
  LEAD_SCORE_POINTS,
  MESSAGE_SIGNAL_MIN_LENGTH,
  priorityFromScore,
  scoreEnquiry,
  type LeadScoreInput,
} from '../services/lead-score';

const NOW = new Date('2026-08-14T12:00:00.000Z');

const quietAssigned: LeadScoreInput = {
  statusSlug: 'contacted',
  isTerminal: false,
  needsReview: false,
  assigned: true,
  nextFollowUpAt: '2026-08-20T12:00:00.000Z',
  interestedCount: 0,
  messageLength: 10,
  openEnquiries: 1,
};

describe('priorityFromScore bands', () => {
  it('maps only low, normal, and high', () => {
    expect(priorityFromScore(LEAD_SCORE_LOW_MAX)).toBe('low');
    expect(priorityFromScore(LEAD_SCORE_LOW_MAX + 1)).toBe('normal');
    expect(priorityFromScore(LEAD_SCORE_NORMAL_MAX)).toBe('normal');
    expect(priorityFromScore(LEAD_SCORE_NORMAL_MAX + 1)).toBe('high');
  });
});

describe('scoreEnquiry', () => {
  it('scores a quiet assigned enquiry as low', () => {
    const result = scoreEnquiry(quietAssigned, NOW);
    expect(result.score).toBe(LEAD_SCORE_BASE);
    expect(result.suggestedPriority).toBe('low');
    expect(result.reasons).toEqual([]);
  });

  it('scores a typical new unassigned enquiry as normal', () => {
    const result = scoreEnquiry(
      {
        statusSlug: 'new',
        isTerminal: false,
        needsReview: false,
        assigned: false,
        nextFollowUpAt: null,
        interestedCount: 0,
        messageLength: 20,
        openEnquiries: 1,
      },
      NOW,
    );
    expect(result.suggestedPriority).toBe('normal');
    expect(result.reasons.map((r) => r.code)).toEqual(['follow_up_missing', 'status_new', 'unassigned']);
    expect(result.score).toBe(
      LEAD_SCORE_BASE +
        LEAD_SCORE_POINTS.follow_up_missing +
        LEAD_SCORE_POINTS.status_new +
        LEAD_SCORE_POINTS.unassigned,
    );
  });

  it('scores review + overdue follow-up as high', () => {
    const result = scoreEnquiry(
      {
        statusSlug: 'follow-up-required',
        isTerminal: false,
        needsReview: true,
        assigned: false,
        nextFollowUpAt: '2026-08-01T00:00:00.000Z',
        interestedCount: 2,
        messageLength: MESSAGE_SIGNAL_MIN_LENGTH,
        openEnquiries: 3,
      },
      NOW,
    );
    expect(result.suggestedPriority).toBe('high');
    expect(result.reasons.map((r) => r.code)).toContain('needs_review');
    expect(result.reasons.map((r) => r.code)).toContain('follow_up_overdue');
    expect(result.reasons.map((r) => r.code)).not.toContain('follow_up_missing');
  });

  it('treats terminal enquiries as low even with leftover urgency fields', () => {
    const result = scoreEnquiry(
      {
        statusSlug: 'won',
        isTerminal: true,
        needsReview: true,
        assigned: false,
        nextFollowUpAt: '2026-01-01T00:00:00.000Z',
        interestedCount: 5,
        messageLength: 400,
        openEnquiries: 4,
      },
      NOW,
    );
    expect(result.suggestedPriority).toBe('low');
    expect(result.reasons).toEqual([
      {
        code: 'terminal_status',
        points: LEAD_SCORE_POINTS.terminal_status,
        label: expect.any(String),
      },
    ]);
    expect(result.score).toBe(Math.max(0, LEAD_SCORE_BASE + LEAD_SCORE_POINTS.terminal_status));
  });

  it('handles missing optional data without throwing', () => {
    const result = scoreEnquiry(
      {
        statusSlug: 'negotiation',
        isTerminal: false,
        needsReview: false,
        assigned: true,
        nextFollowUpAt: undefined,
        interestedCount: 0,
        messageLength: 0,
        openEnquiries: 0,
      },
      NOW,
    );
    expect(result.suggestedPriority).toBe('low');
    expect(result.score).toBe(LEAD_SCORE_BASE);
  });

  it('scores overdue follow-up on an old date using the injected now', () => {
    const result = scoreEnquiry(
      {
        ...quietAssigned,
        nextFollowUpAt: new Date('2020-01-01T00:00:00.000Z'),
      },
      NOW,
    );
    expect(result.reasons.map((r) => r.code)).toEqual(['follow_up_overdue']);
    expect(result.suggestedPriority).toBe('normal');
  });

  it('is deterministic for the same input and now', () => {
    const input: LeadScoreInput = {
      statusSlug: 'new',
      isTerminal: false,
      needsReview: true,
      assigned: false,
      nextFollowUpAt: null,
      interestedCount: 1,
      messageLength: 90,
      openEnquiries: 2,
    };
    expect(scoreEnquiry(input, NOW)).toEqual(scoreEnquiry(input, NOW));
  });

  it('does not emit medium or extra priority slugs', () => {
    for (const score of [0, 39, 40, 69, 70, 100]) {
      expect(['low', 'normal', 'high']).toContain(priorityFromScore(score));
      expect(priorityFromScore(score)).not.toBe('medium');
    }
  });
});
