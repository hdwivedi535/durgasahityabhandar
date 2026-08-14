import type { GenerateCustomerSummaryResponseDto } from '@dsb/shared';
import { apiFetchWithToken } from '@/lib/api-client';

export function generateCustomerSummary(customerId: string, token: string) {
  return apiFetchWithToken<GenerateCustomerSummaryResponseDto>(
    `/admin/customers/${customerId}/ai/summary`,
    token,
    { method: 'POST' },
  );
}
