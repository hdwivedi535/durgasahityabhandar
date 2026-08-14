export const AI_PROVIDERS = ['none', 'openai_compatible'] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_RUN_KINDS = [
  'enquiry_summary',
  'customer_summary',
  'priority_suggestion',
  'suggested_reply',
  'suggested_follow_up',
] as const;

export type AiRunKind = (typeof AI_RUN_KINDS)[number];

export const AI_RUN_STATUSES = ['ok', 'error'] as const;

export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

export const AI_TARGET_TYPES = ['enquiry', 'customer'] as const;

export type AiTargetType = (typeof AI_TARGET_TYPES)[number];

export const AI_ERROR_CODES = [
  'AI_DISABLED',
  'AI_NOT_CONFIGURED',
  'AI_FORBIDDEN',
  'AI_RATE_LIMITED',
  'AI_BUDGET_EXCEEDED',
  'AI_TIMEOUT',
  'AI_PROVIDER_ERROR',
  'AI_STALE_CACHE',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const ENQUIRY_PRIORITY_SLUGS = ['low', 'normal', 'high'] as const;

export type EnquiryPrioritySlug = (typeof ENQUIRY_PRIORITY_SLUGS)[number];

export type LeadScoreReasonCode =
  | 'needs_review'
  | 'follow_up_overdue'
  | 'follow_up_missing'
  | 'status_new'
  | 'status_follow_up'
  | 'unassigned'
  | 'open_enquiries'
  | 'interested_items'
  | 'message_signal'
  | 'terminal_status';

export interface LeadScoreReasonDto {
  code: LeadScoreReasonCode;
  points: number;
  label: string;
}

export interface LeadScoreDto {
  score: number;
  suggestedPriority: EnquiryPrioritySlug;
  reasons: LeadScoreReasonDto[];
  calculatedAt: string;
}

export interface EnquiryAiSummaryDto {
  summary: string;
  fingerprint: string;
  model: string;
  generatedAt: string;
  stale: boolean;
}

export interface EnquiryAiDto {
  leadScore?: LeadScoreDto;
  summary?: EnquiryAiSummaryDto;
}

export interface GenerateEnquirySummaryResponseDto {
  summary: EnquiryAiSummaryDto;
  run: AiRunDto;
}

export type CustomerAiSummaryDto = EnquiryAiSummaryDto;

export interface GenerateCustomerSummaryResponseDto {
  summary: CustomerAiSummaryDto;
  run: AiRunDto;
}

export interface AiRunDto {
  id: string;
  kind: AiRunKind;
  targetType: AiTargetType;
  targetId: string;
  actorId?: string;
  model: string;
  inputFingerprint: string;
  output: string;
  promptHash: string;
  tokenIn: number;
  tokenOut: number;
  latencyMs: number;
  status: AiRunStatus;
  errorCode?: string;
  createdAt: string;
}

export interface AiInsightDto {
  id: string;
  kind: AiRunKind;
  targetType: AiTargetType;
  targetId: string;
  output: string;
  fingerprint: string;
  model: string;
  generatedAt: string;
  stale?: boolean;
}
