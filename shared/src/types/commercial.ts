export const CUSTOMER_RELATIONSHIP_TYPES = ['new', 'existing', 'vip'] as const;
export type CustomerRelationshipType = (typeof CUSTOMER_RELATIONSHIP_TYPES)[number];

export const CREDIT_STATUSES = ['no_credit', 'approved_credit', 'credit_suspended'] as const;
export type CreditStatus = (typeof CREDIT_STATUSES)[number];

export const DEFAULT_PAYMENT_TERMS_SUMMARY = '100% advance before dispatch';
export const CREDIT_LIMIT_CURRENCY = 'INR' as const;

/** Integer paise. ₹1 = 100. Never store commercial money as IEEE floats. */
export type MoneyMinor = number;

export interface CustomerPaymentTermsDto {
  summary: string;
  requirePaymentBeforeDispatch: boolean;
  dueDaysAfterDelivery?: number;
  approvedPaymentDueOn?: string;
}

export interface PendingPaymentDateRequestDto {
  requestedDueOn: string;
  requestedAt: string;
  reason: string;
  requestedById?: string;
  requestedByName?: string;
}

export interface CustomerCreditProfileDto {
  relationshipType: CustomerRelationshipType;
  creditStatus: CreditStatus;
  creditLimitMinor?: MoneyMinor;
  creditLimitCurrency: typeof CREDIT_LIMIT_CURRENCY;
  paymentTerms: CustomerPaymentTermsDto;
  isActive: boolean;
  reviewAt?: string;
  expiresAt?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  version: number;
  pendingPaymentDateRequest?: PendingPaymentDateRequestDto;
}

export interface CreditProfileUpdateInput {
  relationshipType: CustomerRelationshipType;
  creditStatus: CreditStatus;
  creditLimitMinor?: MoneyMinor;
  paymentTerms: {
    summary: string;
    requirePaymentBeforeDispatch: boolean;
    dueDaysAfterDelivery?: number | null;
    approvedPaymentDueOn?: string | null;
  };
  isActive: boolean;
  reviewAt?: string | null;
  expiresAt?: string | null;
  reason: string;
}

export interface PaymentDateExtensionRequestInput {
  requestedDueOn: string;
  reason: string;
}

export interface PaymentDateExtensionResolveInput {
  decision: 'approve' | 'reject';
  /** Required when decision is approve. Admin-entered date; not copied from the request. */
  approvedDueOn?: string;
  reason: string;
}

export function defaultCustomerCreditProfile(): CustomerCreditProfileDto {
  return {
    relationshipType: 'new',
    creditStatus: 'no_credit',
    creditLimitCurrency: CREDIT_LIMIT_CURRENCY,
    paymentTerms: {
      summary: DEFAULT_PAYMENT_TERMS_SUMMARY,
      requirePaymentBeforeDispatch: true,
    },
    isActive: true,
    version: 1,
  };
}
