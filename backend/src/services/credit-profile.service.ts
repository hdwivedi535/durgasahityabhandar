import type {
  CreditProfileUpdateInput,
  CustomerCreditProfileDto,
  PaymentDateExtensionRequestInput,
  PaymentDateExtensionResolveInput,
} from '@dsb/shared';
import { CREDIT_LIMIT_CURRENCY, defaultCustomerCreditProfile } from '@dsb/shared';
import mongoose from 'mongoose';
import type { ICustomer, ICustomerCreditProfile } from '../models/customer.model';
import { defaultCreditProfileDoc } from '../models/customer.model';
import { isMoneyMinor } from '../utils/money';
import {
  CustomerError,
  appendCustomerEvent,
  resolveLiveCustomer,
  toCreditProfileDto,
  type Actor,
} from './customer.service';

function iso(d?: Date): string | undefined {
  return d ? d.toISOString() : undefined;
}

function parseDate(value: string | null | undefined, field: string): Date | undefined {
  if (value == null || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new CustomerError('VALIDATION_ERROR', `Invalid date for ${field}`);
  }
  return d;
}

function actorObjectId(actor?: Actor): mongoose.Types.ObjectId | undefined {
  if (!actor?.id || !mongoose.isValidObjectId(actor.id)) return undefined;
  return new mongoose.Types.ObjectId(actor.id);
}

function snapshotForHistory(dto: CustomerCreditProfileDto): Record<string, unknown> {
  return JSON.parse(JSON.stringify(dto)) as Record<string, unknown>;
}

function ensureProfile(doc: ICustomer): ICustomerCreditProfile {
  if (!doc.creditProfile) {
    doc.creditProfile = defaultCreditProfileDoc();
  }
  return doc.creditProfile;
}

function buildNextProfile(
  doc: ICustomer,
  input: CreditProfileUpdateInput,
  actor?: Actor,
): ICustomerCreditProfile {
  const reason = input.reason.trim();
  if (!reason) {
    throw new CustomerError('VALIDATION_ERROR', 'A reason is required for commercial profile changes');
  }

  if (input.creditStatus === 'approved_credit') {
    if (input.creditLimitMinor === undefined) {
      throw new CustomerError('VALIDATION_ERROR', 'Credit limit is required when credit is approved');
    }
    if (!isMoneyMinor(input.creditLimitMinor)) {
      throw new CustomerError(
        'VALIDATION_ERROR',
        'creditLimitMinor must be a non-negative integer in paise',
      );
    }
  } else if (input.creditLimitMinor !== undefined && !isMoneyMinor(input.creditLimitMinor)) {
    throw new CustomerError(
      'VALIDATION_ERROR',
      'creditLimitMinor must be a non-negative integer in paise',
    );
  } else if (input.creditStatus === 'no_credit' && (input.creditLimitMinor ?? 0) > 0) {
    throw new CustomerError(
      'VALIDATION_ERROR',
      'A positive credit limit cannot be stored while credit status is no_credit',
    );
  }

  const summary = input.paymentTerms.summary.trim();
  if (!summary) {
    throw new CustomerError('VALIDATION_ERROR', 'Approved payment terms summary is required');
  }
  if (
    input.paymentTerms.dueDaysAfterDelivery != null &&
    (!Number.isInteger(input.paymentTerms.dueDaysAfterDelivery) ||
      input.paymentTerms.dueDaysAfterDelivery < 0)
  ) {
    throw new CustomerError('VALIDATION_ERROR', 'dueDaysAfterDelivery must be a non-negative integer');
  }

  const current = ensureProfile(doc);
  const next: ICustomerCreditProfile = {
    relationshipType: input.relationshipType,
    creditStatus: input.creditStatus,
    creditLimitMinor: input.creditStatus === 'no_credit' ? undefined : input.creditLimitMinor,
    creditLimitCurrency: CREDIT_LIMIT_CURRENCY,
    paymentTerms: {
      summary,
      requirePaymentBeforeDispatch: input.paymentTerms.requirePaymentBeforeDispatch,
      dueDaysAfterDelivery: input.paymentTerms.dueDaysAfterDelivery ?? undefined,
      approvedPaymentDueOn: parseDate(input.paymentTerms.approvedPaymentDueOn, 'approvedPaymentDueOn'),
    },
    isActive: input.isActive,
    reviewAt: parseDate(input.reviewAt, 'reviewAt'),
    expiresAt: parseDate(input.expiresAt, 'expiresAt'),
    approvedById: current.approvedById,
    approvedByName: current.approvedByName,
    approvedAt: current.approvedAt,
    version: (current.version || 1) + 1,
    pendingPaymentDateRequest: current.pendingPaymentDateRequest,
  };

  if (input.creditStatus === 'approved_credit' || input.creditStatus === 'credit_suspended') {
    next.approvedById = actorObjectId(actor) ?? current.approvedById;
    next.approvedByName = actor?.name ?? current.approvedByName;
    next.approvedAt = new Date();
  }

  return next;
}

export async function updateCustomerCreditProfile(
  customerId: string,
  input: CreditProfileUpdateInput,
  actor?: Actor,
): Promise<CustomerCreditProfileDto> {
  const doc = await resolveLiveCustomer(customerId);
  ensureProfile(doc);
  const previous = toCreditProfileDto(doc.creditProfile);
  doc.creditProfile = buildNextProfile(doc, input, actor);
  await doc.save();
  const next = toCreditProfileDto(doc.creditProfile);
  await appendCustomerEvent(
    doc._id.toString(),
    'credit_profile_changed',
    {
      version: next.version,
      previous: snapshotForHistory(previous),
      next: snapshotForHistory(next),
      reason: input.reason.trim(),
    },
    actor,
  );
  return next;
}

export async function requestPaymentDateExtension(
  customerId: string,
  input: PaymentDateExtensionRequestInput,
  actor?: Actor,
): Promise<CustomerCreditProfileDto> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new CustomerError('VALIDATION_ERROR', 'A reason is required to request a payment-date extension');
  }
  const requestedDueOn = parseDate(input.requestedDueOn, 'requestedDueOn');
  if (!requestedDueOn) {
    throw new CustomerError('VALIDATION_ERROR', 'requestedDueOn is required');
  }

  const doc = await resolveLiveCustomer(customerId);
  const profile = ensureProfile(doc);
  const previousDueOn = profile.paymentTerms?.approvedPaymentDueOn;

  profile.pendingPaymentDateRequest = {
    requestedDueOn,
    requestedAt: new Date(),
    reason,
    requestedById: actorObjectId(actor),
    requestedByName: actor?.name,
  };
  doc.markModified('creditProfile');
  await doc.save();

  await appendCustomerEvent(
    doc._id.toString(),
    'payment_date_extension_requested',
    {
      previousDueOn: iso(previousDueOn) ?? null,
      requestedDueOn: requestedDueOn.toISOString(),
      reason,
      approvedPaymentDueOnUnchanged: iso(profile.paymentTerms.approvedPaymentDueOn) ?? null,
    },
    actor,
  );
  return toCreditProfileDto(doc.creditProfile);
}

export async function resolvePaymentDateExtension(
  customerId: string,
  input: PaymentDateExtensionResolveInput,
  actor?: Actor,
): Promise<CustomerCreditProfileDto> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new CustomerError('VALIDATION_ERROR', 'A reason is required to resolve a payment-date extension');
  }
  const doc = await resolveLiveCustomer(customerId);
  const profile = ensureProfile(doc);
  if (!profile.pendingPaymentDateRequest) {
    throw new CustomerError('VALIDATION_ERROR', 'There is no pending payment-date extension request');
  }

  const previous = toCreditProfileDto(profile);
  const previousDueOn = profile.paymentTerms.approvedPaymentDueOn;
  const requestedDueOn = profile.pendingPaymentDateRequest.requestedDueOn;

  if (input.decision === 'approve') {
    const approvedDueOn = parseDate(input.approvedDueOn, 'approvedDueOn');
    if (!approvedDueOn) {
      throw new CustomerError(
        'VALIDATION_ERROR',
        'Admin must manually enter approvedDueOn; the requested date is not applied automatically',
      );
    }
    profile.paymentTerms.approvedPaymentDueOn = approvedDueOn;
    profile.approvedById = actorObjectId(actor) ?? profile.approvedById;
    profile.approvedByName = actor?.name ?? profile.approvedByName;
    profile.approvedAt = new Date();
  } else if (input.decision !== 'reject') {
    throw new CustomerError('VALIDATION_ERROR', 'decision must be approve or reject');
  }

  profile.pendingPaymentDateRequest = undefined;
  profile.version = (profile.version || 1) + 1;
  doc.markModified('creditProfile');
  await doc.save();
  const next = toCreditProfileDto(doc.creditProfile);

  await appendCustomerEvent(
    doc._id.toString(),
    'payment_date_extension_resolved',
    {
      decision: input.decision,
      version: next.version,
      previousDueOn: iso(previousDueOn) ?? null,
      newDueOn: next.paymentTerms.approvedPaymentDueOn ?? null,
      requestedDueOn: requestedDueOn.toISOString(),
      reason,
      previous: snapshotForHistory(previous),
      next: snapshotForHistory(next),
    },
    actor,
  );
  return next;
}

export { defaultCustomerCreditProfile };
