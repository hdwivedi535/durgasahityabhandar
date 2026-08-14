import type { GenerateEnquirySummaryResponseDto } from '@dsb/shared';
import { apiFetchWithToken } from '@/lib/api-client';

export function generateEnquirySummary(enquiryId: string, token: string) {
  return apiFetchWithToken<GenerateEnquirySummaryResponseDto>(
    `/admin/enquiries/${enquiryId}/ai/summary`,
    token,
    { method: 'POST' },
  );
}
