import type { EnquiryPrioritySlug, LeadScoreDto, LeadScoreReasonCode, LeadScoreReasonDto } from '@dsb/shared';

/**
 * Deterministic enquiry lead score (no LLM).
 *
 * Base 30, clamp 0–100, then band:
 *   low    score < 40
 *   normal 40 ≤ score < 70
 *   high   score ≥ 70
 *
 * Signals (open/non-terminal enquiries):
 *   needs_review        +20  identity needsReview
 *   follow_up_overdue   +25  nextFollowUpAt ≤ now
 *   follow_up_missing    +8  no follow-up while new/contacted/follow-up-required
 *   status_new          +12  status slug new
 *   status_follow_up    +15  status slug follow-up-required
 *   unassigned          +10  no assignee
 *   open_enquiries       +8  customer has 2+ open enquiries
 *   interested_items     +8  at least one book or category
 *   message_signal       +6  message+requirement length ≥ 80
 *
 * Terminal won/lost/closed: only terminal_status −40 (skips urgency signals).
 * Does not read or write CRM priorityId (low/normal/high remains agent-set).
 */
export const LEAD_SCORE_BASE = 30;
export const LEAD_SCORE_LOW_MAX = 39;
export const LEAD_SCORE_NORMAL_MAX = 69;
export const MESSAGE_SIGNAL_MIN_LENGTH = 80;
export const REPEAT_OPEN_ENQUIRY_MIN = 2;

const FOLLOW_UP_MISSING_STATUSES = new Set(['new', 'contacted', 'follow-up-required']);

export const LEAD_SCORE_POINTS: Record<LeadScoreReasonCode, number> = {
  needs_review: 20,
  follow_up_overdue: 25,
  follow_up_missing: 8,
  status_new: 12,
  status_follow_up: 15,
  unassigned: 10,
  open_enquiries: 8,
  interested_items: 8,
  message_signal: 6,
  terminal_status: -40,
};

const LABELS: Record<LeadScoreReasonCode, string> = {
  needs_review: 'Customer or enquiry flagged for review',
  follow_up_overdue: 'Follow-up date is overdue',
  follow_up_missing: 'No follow-up date set',
  status_new: 'Enquiry is still new',
  status_follow_up: 'Enquiry is in follow-up required',
  unassigned: 'Enquiry is unassigned',
  open_enquiries: 'Customer has multiple open enquiries',
  interested_items: 'Catalogue books or categories were specified',
  message_signal: 'Requirement text is detailed',
  terminal_status: 'Enquiry is won, lost, or closed',
};

export interface LeadScoreInput {
  statusSlug: string;
  isTerminal: boolean;
  needsReview: boolean;
  assigned: boolean;
  nextFollowUpAt?: Date | string | null;
  interestedCount: number;
  messageLength: number;
  openEnquiries: number;
}

export function priorityFromScore(score: number): EnquiryPrioritySlug {
  if (score >= LEAD_SCORE_NORMAL_MAX + 1) return 'high';
  if (score >= LEAD_SCORE_LOW_MAX + 1) return 'normal';
  return 'low';
}

function reason(code: LeadScoreReasonCode): LeadScoreReasonDto {
  return { code, points: LEAD_SCORE_POINTS[code], label: LABELS[code] };
}

function asDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

export function scoreEnquiry(input: LeadScoreInput, now = new Date()): LeadScoreDto {
  const reasons: LeadScoreReasonDto[] = [];

  if (input.isTerminal) {
    reasons.push(reason('terminal_status'));
  } else {
    if (input.needsReview) reasons.push(reason('needs_review'));

    const followUpAt = asDate(input.nextFollowUpAt ?? null);
    if (followUpAt && followUpAt.getTime() <= now.getTime()) {
      reasons.push(reason('follow_up_overdue'));
    } else if (!followUpAt && FOLLOW_UP_MISSING_STATUSES.has(input.statusSlug)) {
      reasons.push(reason('follow_up_missing'));
    }

    if (input.statusSlug === 'new') reasons.push(reason('status_new'));
    if (input.statusSlug === 'follow-up-required') reasons.push(reason('status_follow_up'));
    if (!input.assigned) reasons.push(reason('unassigned'));
    if ((input.openEnquiries ?? 0) >= REPEAT_OPEN_ENQUIRY_MIN) reasons.push(reason('open_enquiries'));
    if ((input.interestedCount ?? 0) >= 1) reasons.push(reason('interested_items'));
    if ((input.messageLength ?? 0) >= MESSAGE_SIGNAL_MIN_LENGTH) reasons.push(reason('message_signal'));
  }

  const raw = reasons.reduce((sum, item) => sum + item.points, LEAD_SCORE_BASE);
  const score = Math.min(100, Math.max(0, raw));

  return {
    score,
    suggestedPriority: priorityFromScore(score),
    reasons,
    calculatedAt: now.toISOString(),
  };
}
