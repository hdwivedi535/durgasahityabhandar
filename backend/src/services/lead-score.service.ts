import type { LeadScoreDto } from '@dsb/shared';
import type { IEnquiry } from '../models/enquiry.model';
import { Customer } from '../models/customer.model';
import { getCrmConfigById } from './crm-config.service';
import { scoreEnquiry } from './lead-score';

export function toStoredLeadScore(dto: LeadScoreDto): NonNullable<IEnquiry['leadScore']> {
  return {
    score: dto.score,
    suggestedPriority: dto.suggestedPriority,
    reasons: dto.reasons,
    calculatedAt: new Date(dto.calculatedAt),
  };
}

export function toLeadScoreDto(stored: NonNullable<IEnquiry['leadScore']>): LeadScoreDto {
  return {
    score: stored.score,
    suggestedPriority: stored.suggestedPriority,
    reasons: stored.reasons,
    calculatedAt: stored.calculatedAt.toISOString(),
  };
}

export async function buildLeadScoreForEnquiry(doc: IEnquiry, now = new Date()): Promise<LeadScoreDto> {
  const [status, customer] = await Promise.all([
    getCrmConfigById(doc.statusId.toString()),
    Customer.findById(doc.customerId).select('stats'),
  ]);
  const message = doc.message ?? '';
  const requirement = doc.requirementText ?? '';
  return scoreEnquiry(
    {
      statusSlug: status?.slug ?? 'new',
      isTerminal: Boolean(status?.isTerminal),
      needsReview: Boolean(doc.needsReview),
      assigned: Boolean(doc.assignedUserId),
      nextFollowUpAt: doc.nextFollowUpAt ?? null,
      interestedCount:
        (doc.interestedBookIds?.length ?? 0) + (doc.interestedCategoryIds?.length ?? 0),
      messageLength: `${message}${requirement}`.trim().length,
      openEnquiries: customer?.stats?.openEnquiries ?? 0,
    },
    now,
  );
}

export async function assignLeadScore(doc: IEnquiry, now = new Date()): Promise<LeadScoreDto> {
  const dto = await buildLeadScoreForEnquiry(doc, now);
  doc.leadScore = toStoredLeadScore(dto);
  return dto;
}
