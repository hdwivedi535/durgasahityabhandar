import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthUser, CustomerDetailDto } from '@dsb/shared';
import { CustomerAiSummaryCard } from '@/components/admin/customer-ai-summary-card';
import { userHasPermission } from '@/lib/rbac';
import { getAiActionMessage } from '@/lib/ai-errors';
import { generateCustomerSummary } from '@/lib/customer-ai-api';
import { ApiClientError } from '@/lib/api-client';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    apiFetchWithToken: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'c1' }),
}));

const authState: { accessToken: string | null; user: AuthUser | null } = {
  accessToken: 'token',
  user: null,
};

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { apiFetchWithToken } from '@/lib/api-client';
import AdminCustomerDetailPage from '@/app/admin/customers/[id]/page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  authState.accessToken = 'token';
  authState.user = adminUser;
});

const adminUser: AuthUser = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  status: 'active',
  roleSlugs: [],
  permissions: ['customers.generate_ai', 'customers.view', 'customers.edit'],
  moduleAccess: ['customers'],
  accessScope: 'all',
  preferredLanguage: 'en',
  timezone: 'Asia/Kolkata',
};

const viewerUser: AuthUser = {
  ...adminUser,
  permissions: ['customers.view'],
};

const customer: CustomerDetailDto = {
  id: 'c1',
  customerNumber: 'CUST-00001',
  businessName: 'ABC Books',
  contactName: 'Ada',
  country: 'NP',
  phoneCountry: 'IN',
  phoneDialCode: '91',
  phone: '+919876543210',
  phoneNormalized: '+919876543210',
  preferredLanguage: 'en',
  location: {},
  tags: [],
  stats: { totalEnquiries: 0, openEnquiries: 0 },
  needsReview: false,
  isArchived: false,
  createdAt: '2026-08-14T12:00:00.000Z',
  updatedAt: '2026-08-14T12:00:00.000Z',
  timeline: [
    {
      id: 'ev1',
      customerId: 'c1',
      eventType: 'created',
      data: {},
      createdAt: '2026-08-14T12:00:00.000Z',
    },
  ],
  recentEnquiries: [],
};

const storedSummary = {
  summary: 'ABC Books is a Nepal-based wholesale contact using an Indian phone number.',
  fingerprint: 'fp',
  model: 'mock',
  generatedAt: '2026-08-14T12:00:00.000Z',
  stale: false,
};

const generateResponse = {
  summary: {
    summary: 'Generated customer overview.',
    fingerprint: 'fp2',
    model: 'mock',
    generatedAt: '2026-08-14T13:00:00.000Z',
    stale: false,
  },
  run: {
    id: 'r1',
    kind: 'customer_summary' as const,
    targetType: 'customer' as const,
    targetId: 'c1',
    model: 'mock',
    inputFingerprint: 'fp2',
    output: 'Generated customer overview.',
    promptHash: 'h',
    tokenIn: 1,
    tokenOut: 1,
    latencyMs: 1,
    status: 'ok' as const,
    createdAt: '2026-08-14T13:00:00.000Z',
  },
};

authState.user = adminUser;

describe('CustomerAiSummaryCard', () => {
  it('shows an empty state and Generate when allowed', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<CustomerAiSummaryCard canGenerate generating={false} onGenerate={onGenerate} />);
    expect(screen.getByTestId('ai-summary-empty').textContent).toMatch(/no ai summary yet/i);
    await user.click(screen.getByRole('button', { name: 'Generate summary' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows stored summary and Regenerate', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(
      <CustomerAiSummaryCard
        canGenerate
        generating={false}
        onGenerate={onGenerate}
        summary={storedSummary}
      />,
    );
    expect(screen.getByTestId('ai-summary-text').textContent).toContain('ABC Books');
    await user.click(screen.getByRole('button', { name: 'Regenerate summary' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('hides generate for unauthorized users', () => {
    render(<CustomerAiSummaryCard canGenerate={false} generating={false} onGenerate={() => undefined} />);
    expect(screen.getByTestId('ai-summary-empty').textContent).toMatch(/no ai summary yet/i);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('RBAC and AI errors', () => {
  it('allows customers.generate_ai for super-admin and explicit permission only', () => {
    expect(userHasPermission({ ...adminUser, permissions: ['customers.view'] }, 'customers.generate_ai')).toBe(
      false,
    );
    expect(userHasPermission(adminUser, 'customers.generate_ai')).toBe(true);
    expect(
      userHasPermission({ ...adminUser, roleSlugs: ['super-admin'], permissions: [] }, 'customers.generate_ai'),
    ).toBe(true);
  });

  it('maps AI disabled, not configured, budget, forbidden, not found, and network errors', () => {
    expect(getAiActionMessage(new ApiClientError('FORBIDDEN', 'no', 403))).toMatch(/permission/i);
    expect(getAiActionMessage(new ApiClientError('AI_DISABLED', 'off', 403))).toMatch(/disabled/i);
    expect(getAiActionMessage(new ApiClientError('AI_NOT_CONFIGURED', 'none', 503))).toMatch(
      /not configured/i,
    );
    expect(getAiActionMessage(new ApiClientError('AI_BUDGET_EXCEEDED', 'budget', 429))).toMatch(/budget/i);
    expect(getAiActionMessage(new ApiClientError('NOT_FOUND', 'missing', 404))).toMatch(/not be found/i);
    expect(getAiActionMessage(new ApiClientError('NETWORK_ERROR', 'down', 0))).toMatch(/could not reach/i);
  });
});

describe('generateCustomerSummary API helper', () => {
  it('posts only to the existing customer summary endpoint', async () => {
    vi.mocked(apiFetchWithToken).mockResolvedValue(generateResponse);
    await generateCustomerSummary('c1', 'token');
    expect(apiFetchWithToken).toHaveBeenCalledWith('/admin/customers/c1/ai/summary', 'token', {
      method: 'POST',
    });
    const urls = vi.mocked(apiFetchWithToken).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/enquiries/'))).toBe(false);
  });
});

describe('Admin customer detail AI summary', () => {
  function mockCustomerGet(detail: CustomerDetailDto = customer) {
    vi.mocked(apiFetchWithToken).mockImplementation(async (path, _token, options) => {
      if (path === '/admin/customers/c1' && options?.method === 'POST') {
        throw new Error('unexpected POST to customer GET path');
      }
      if (path === '/admin/customers/c1/ai/summary') {
        return generateResponse as never;
      }
      return detail as never;
    });
  }

  it('shows empty state when the customer has no stored summary', async () => {
    mockCustomerGet();
    render(<AdminCustomerDetailPage />);
    expect(await screen.findByTestId('ai-summary-empty')).toBeTruthy();
    expect(screen.getByText('ABC Books')).toBeTruthy();
    expect(screen.getByText(/Location:/)).toBeTruthy();
    expect(screen.getByText(/Phone country:/)).toBeTruthy();
  });

  it('shows a stored summary from GET without generating', async () => {
    mockCustomerGet({ ...customer, aiSummary: storedSummary });
    render(<AdminCustomerDetailPage />);
    expect((await screen.findByTestId('ai-summary-text')).textContent).toContain('Nepal-based');
    expect(screen.queryByTestId('ai-summary-empty')).toBeNull();
    const posts = vi.mocked(apiFetchWithToken).mock.calls.filter((c) => c[2]?.method === 'POST');
    expect(posts).toHaveLength(0);
  });

  it('calls the CP4 endpoint on generate and displays the result', async () => {
    mockCustomerGet();
    const user = userEvent.setup();
    render(<AdminCustomerDetailPage />);
    await screen.findByTestId('ai-summary-empty');
    await user.click(screen.getByRole('button', { name: 'Generate summary' }));
    expect((await screen.findByTestId('ai-summary-text')).textContent).toContain(
      'Generated customer overview.',
    );
    expect(apiFetchWithToken).toHaveBeenCalledWith('/admin/customers/c1/ai/summary', 'token', {
      method: 'POST',
    });
    expect(screen.getByText('ABC Books')).toBeTruthy();
    expect(screen.getByDisplayValue('Ada')).toBeTruthy();
  });

  it('calls the same endpoint again on regenerate', async () => {
    mockCustomerGet({ ...customer, aiSummary: storedSummary });
    const user = userEvent.setup();
    render(<AdminCustomerDetailPage />);
    await screen.findByRole('button', { name: 'Regenerate summary' });
    await user.click(screen.getByRole('button', { name: 'Regenerate summary' }));
    await waitFor(() =>
      expect(apiFetchWithToken).toHaveBeenCalledWith('/admin/customers/c1/ai/summary', 'token', {
        method: 'POST',
      }),
    );
  });

  it('hides generate controls without customers.generate_ai', async () => {
    authState.user = viewerUser;
    mockCustomerGet();
    render(<AdminCustomerDetailPage />);
    await screen.findByTestId('ai-summary-empty');
    expect(screen.queryByRole('button', { name: /summary/i })).toBeNull();
  });

  it('shows AI_DISABLED, AI_NOT_CONFIGURED, AI_BUDGET_EXCEEDED, and network errors', async () => {
    const cases: Array<[ApiClientError, RegExp]> = [
      [new ApiClientError('AI_DISABLED', 'off', 403), /disabled/i],
      [new ApiClientError('AI_NOT_CONFIGURED', 'none', 503), /not configured/i],
      [new ApiClientError('AI_BUDGET_EXCEEDED', 'budget', 429), /budget/i],
      [new ApiClientError('NETWORK_ERROR', 'down', 0), /could not reach/i],
    ];
    for (const [err, pattern] of cases) {
      cleanup();
      vi.mocked(apiFetchWithToken).mockImplementation(async (path, _token, options) => {
        if (options?.method === 'POST') throw err;
        return customer as never;
      });
      const user = userEvent.setup();
      render(<AdminCustomerDetailPage />);
      await screen.findByRole('button', { name: 'Generate summary' });
      await user.click(screen.getByRole('button', { name: 'Generate summary' }));
      expect((await screen.findByRole('alert')).textContent).toMatch(pattern);
      expect(screen.getByText('ABC Books')).toBeTruthy();
    }
  });
});
