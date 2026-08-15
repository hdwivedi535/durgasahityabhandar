import {
  CREDIT_LIMIT_CURRENCY,
  CREDIT_STATUSES,
  CUSTOMER_RELATIONSHIP_TYPES,
  DEFAULT_PAYMENT_TERMS_SUMMARY,
  type CreditStatus,
  type CustomerRelationshipType,
} from '@dsb/shared';
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICustomerPaymentTerms {
  summary: string;
  requirePaymentBeforeDispatch: boolean;
  dueDaysAfterDelivery?: number;
  approvedPaymentDueOn?: Date;
}

export interface IPendingPaymentDateRequest {
  requestedDueOn: Date;
  requestedAt: Date;
  reason: string;
  requestedById?: Types.ObjectId;
  requestedByName?: string;
}

export interface ICustomerCreditProfile {
  relationshipType: CustomerRelationshipType;
  creditStatus: CreditStatus;
  creditLimitMinor?: number;
  creditLimitCurrency: typeof CREDIT_LIMIT_CURRENCY;
  paymentTerms: ICustomerPaymentTerms;
  isActive: boolean;
  reviewAt?: Date;
  expiresAt?: Date;
  approvedById?: Types.ObjectId;
  approvedByName?: string;
  approvedAt?: Date;
  version: number;
  pendingPaymentDateRequest?: IPendingPaymentDateRequest;
}

export interface ICustomer extends Document {
  customerNumber: string;
  businessName: string;
  contactName: string;
  country: string;
  phoneCountry: string;
  phoneDialCode: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  emailNormalized?: string;
  preferredLanguage: string;
  location: { city?: string; state?: string; address?: string };
  tags: string[];
  stats: { totalEnquiries: number; openEnquiries: number };
  needsReview: boolean;
  mergedIntoId?: Types.ObjectId;
  isArchived: boolean;
  creditProfile: ICustomerCreditProfile;
  createdAt: Date;
  updatedAt: Date;
}

export function defaultCreditProfileDoc(): ICustomerCreditProfile {
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

const paymentTermsSchema = new Schema<ICustomerPaymentTerms>(
  {
    summary: { type: String, required: true, trim: true, default: DEFAULT_PAYMENT_TERMS_SUMMARY },
    requirePaymentBeforeDispatch: { type: Boolean, required: true, default: true },
    dueDaysAfterDelivery: { type: Number, min: 0 },
    approvedPaymentDueOn: { type: Date },
  },
  { _id: false },
);

const pendingPaymentDateRequestSchema = new Schema<IPendingPaymentDateRequest>(
  {
    requestedDueOn: { type: Date, required: true },
    requestedAt: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    requestedById: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedByName: { type: String },
  },
  { _id: false },
);

const creditProfileSchema = new Schema<ICustomerCreditProfile>(
  {
    relationshipType: {
      type: String,
      required: true,
      enum: CUSTOMER_RELATIONSHIP_TYPES,
      default: 'new',
    },
    creditStatus: {
      type: String,
      required: true,
      enum: CREDIT_STATUSES,
      default: 'no_credit',
    },
    creditLimitMinor: { type: Number, min: 0 },
    creditLimitCurrency: { type: String, required: true, default: CREDIT_LIMIT_CURRENCY },
    paymentTerms: { type: paymentTermsSchema, required: true, default: () => ({}) },
    isActive: { type: Boolean, required: true, default: true },
    reviewAt: { type: Date },
    expiresAt: { type: Date },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedByName: { type: String },
    approvedAt: { type: Date },
    version: { type: Number, required: true, default: 1, min: 1 },
    pendingPaymentDateRequest: { type: pendingPaymentDateRequestSchema },
  },
  { _id: false },
);

const customerSchema = new Schema<ICustomer>(
  {
    customerNumber: { type: String, required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    country: { type: String, required: true, uppercase: true, trim: true, default: 'IN' },
    phoneCountry: { type: String, required: true, uppercase: true, trim: true, default: 'IN' },
    phoneDialCode: { type: String, required: true, trim: true, default: '91' },
    phone: { type: String, required: true },
    phoneNormalized: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    emailNormalized: { type: String, lowercase: true, trim: true },
    preferredLanguage: { type: String, default: 'en' },
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    tags: [{ type: String, trim: true }],
    stats: {
      totalEnquiries: { type: Number, default: 0 },
      openEnquiries: { type: Number, default: 0 },
    },
    needsReview: { type: Boolean, default: false },
    mergedIntoId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    isArchived: { type: Boolean, default: false },
    creditProfile: { type: creditProfileSchema, required: true, default: defaultCreditProfileDoc },
  },
  { timestamps: true },
);

customerSchema.index(
  { phoneNormalized: 1 },
  {
    unique: true,
    // Equality only: $exists:false is rejected by MongoDB partial indexes ($not $exists).
    // needsReview:false keeps Phase 4 ambiguous public creates (duplicate phone, flagged for review)
    // out of the unique set; merged rows are excluded via mergedIntoId: null.
    partialFilterExpression: { mergedIntoId: null, needsReview: false },
  },
);
customerSchema.index(
  { emailNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      emailNormalized: { $exists: true, $gt: '' },
      mergedIntoId: null,
      needsReview: false,
    },
  },
);
customerSchema.index({ businessName: 'text', contactName: 'text' });
customerSchema.index({ isArchived: 1, needsReview: 1, createdAt: -1 });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
