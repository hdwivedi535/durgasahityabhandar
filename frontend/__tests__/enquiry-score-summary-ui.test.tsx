import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EnquiryDto } from '@dsb/shared';
import { EnquiryLeadScoreCard } from '@/components/admin/enquiry-lead-score-card';
import { EnquiryAiSummaryCard } from '@/components/admin/enquiry-ai-summary-card';
import { userHasPermission } from '@/lib/rbac';
import { getAiActionMessage } from '@/lib/ai-errors';
import { generateEnquirySummary } from '@/lib/enquiry-ai-api';
import { ApiClientError } from '@/lib/api-client';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    apiFetchWithToken: vi.fn(),
  };
});

import { apiFetchWithToken } from '@/lib/api-client';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const enquiry = {
  id: 'e1',
  enquiryNumber: 'ENQ-0001',
  customerId: 'c1',
  source: 'website' as const,
  statusId: 's1',
  priorityId: 'p-high',
  priority: {
    id: 'p-high',
    kind: 'enquiryPriority' as const,
    slug: 'high',
    name: 'High',
    color: '#f00',
    displayOrder: 1,
    isActive: true,
    isPublic: true,
    isTerminal: false,
  },
  contactName: 'Ada',
  company: 'ABC',
  country: 'NP',
  phoneCountry: 'IN',
  phoneDialCode: '91',
  phone: '+919876543210',
  phoneNormalized: '+919876543210',
  message: 'Need books',
  interestedBookIds: [],
  interestedCategoryIds: [],
  subject: 'Books',
  needsReview: false,
  tags: [],
  isArchived: false,
  createdAt: '2026-08-14T12:00:00.000Z',
  updatedAt: '2026-08-14T12:00:00.000Z',
  leadScore: {
    score: 78,
    suggestedPriority: 'high' as const,
    calculatedAt: '2026-08-14T12:00:00.000Z',
    reasons: [
      { code: 'status_new' as const, points: 12, label: 'Enquiry is still new' },
      { code: 'unassigned' as const, points: 10, label: 'Enquiry is unassigned' },
    ],
  },
} satisfies EnquiryDto;

describe('EnquiryLeadScoreCard', () => {
  it('shows CRM priority separately from heuristic score and band', () => {
    render(<EnquiryLeadScoreCard enquiry={enquiry} />);
    expect(screen.getByTestId('crm-priority').textContent).toBe('High');
    expect(screen.getByTestId('heuristic-score').textContent).toBe('78');
    expect(screen.getByTestId('suggested-band').textContent).toBe('High');
    expect(screen.getByTestId('score-reasons').textContent).toContain('Enquiry is still new');
    expect(screen.getByTestId('score-reasons').textContent).toContain('Enquiry is unassigned');
    expect(screen.queryByText(/medium/i)).toBeNull();
    expect(screen.getByText(/does not change CRM priority/i)).toBeTruthy();
  });

  it('keeps CRM priority when the suggested band differs', () => {
    render(
      <EnquiryLeadScoreCard
        enquiry={{
          ...enquiry,
          priority: { ...enquiry.priority!, slug: 'low', name: 'Low' },
          leadScore: { ...enquiry.leadScore!, suggestedPriority: 'high', score: 80 },
        }}
      />,
    );
    expect(screen.getByTestId('crm-priority').textContent).toBe('Low');
    expect(screen.getByTestId('suggested-band').textContent).toBe('High');
  });
});

describe('EnquiryAiSummaryCard', () => {
  it('shows an empty state and Generate when allowed', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<EnquiryAiSummaryCard canGenerate generating={false} onGenerate={onGenerate} />);
    expect(screen.getByTestId('ai-summary-empty').textContent).toMatch(/no ai summary yet/i);
    await user.click(screen.getByRole('button', { name: 'Generate summary' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows stored summary and Regenerate', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(
      <EnquiryAiSummaryCard
        canGenerate
        generating={false}
        onGenerate={onGenerate}
        summary={{
          summary: 'Temple library needs wholesale books.',
          fingerprint: 'fp',
          model: 'mock',
          generatedAt: '2026-08-14T12:00:00.000Z',
          stale: false,
        }}
      />,
    );
    expect(screen.getByTestId('ai-summary-text').textContent).toContain('Temple library');
    await user.click(screen.getByRole('button', { name: 'Regenerate summary' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows loading and hides generate for unauthorized users', () => {
    render(<EnquiryAiSummaryCard canGenerate={false} generating onGenerate={() => undefined} />);
    expect(screen.getByTestId('summary-loading')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders generation errors', () => {
    render(
      <EnquiryAiSummaryCard
        canGenerate
        generating={false}
        error="CRM AI is currently disabled. Summaries cannot be generated until it is enabled."
        onGenerate={() => undefined}
      />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/disabled/i);
  });
});

describe('RBAC and AI errors', () => {
  const baseUser = {
    id: 'u1',
    email: 'a@b.c',
    name: 'A',
    status: 'active' as const,
    roleSlugs: [] as string[],
    permissions: [] as Array<'enquiries.generate_ai' | 'enquiries.view'>,
    moduleAccess: ['enquiries' as const],
    accessScope: 'all' as const,
    preferredLanguage: 'en',
    timezone: 'Asia/Kolkata',
  };

  it('allows generate_ai for super-admin and explicit permission only', () => {
    expect(userHasPermission({ ...baseUser, permissions: ['enquiries.view'] }, 'enquiries.generate_ai')).toBe(
      false,
    );
    expect(
      userHasPermission({ ...baseUser, permissions: ['enquiries.generate_ai'] }, 'enquiries.generate_ai'),
    ).toBe(true);
    expect(userHasPermission({ ...baseUser, roleSlugs: ['super-admin'] }, 'enquiries.generate_ai')).toBe(
      true,
    );
  });

  it('maps AI disabled, not configured, budget, and 403', () => {
    expect(getAiActionMessage(new ApiClientError('FORBIDDEN', 'no', 403))).toMatch(/permission/i);
    expect(getAiActionMessage(new ApiClientError('AI_DISABLED', 'off', 403))).toMatch(/disabled/i);
    expect(getAiActionMessage(new ApiClientError('AI_NOT_CONFIGURED', 'none', 503))).toMatch(
      /not configured/i,
    );
    expect(getAiActionMessage(new ApiClientError('AI_BUDGET_EXCEEDED', 'budget', 429))).toMatch(/budget/i);
    expect(getAiActionMessage(new ApiClientError('AI_PROVIDER_ERROR', 'fail', 502))).toMatch(
      /could not generate/i,
    );
  });
});

describe('generateEnquirySummary API helper', () => {
  it('posts only to the existing enquiry summary endpoint', async () => {
    vi.mocked(apiFetchWithToken).mockResolvedValue({
      summary: {
        summary: 'ok',
        fingerprint: 'fp',
        model: 'mock',
        generatedAt: '2026-08-14T12:00:00.000Z',
        stale: false,
      },
      run: {
        id: 'r1',
        kind: 'enquiry_summary',
        targetType: 'enquiry',
        targetId: 'e1',
        model: 'mock',
        inputFingerprint: 'fp',
        output: 'ok',
        promptHash: 'h',
        tokenIn: 1,
        tokenOut: 1,
        latencyMs: 1,
        status: 'ok',
        createdAt: '2026-08-14T12:00:00.000Z',
      },
    });
    await generateEnquirySummary('e1', 'token');
    expect(apiFetchWithToken).toHaveBeenCalledWith('/admin/enquiries/e1/ai/summary', 'token', {
      method: 'POST',
    });
    const urls = vi.mocked(apiFetchWithToken).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/priority'))).toBe(false);
  });
});
