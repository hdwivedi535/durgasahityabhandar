import mongoose, { Schema, type Document, type Types } from 'mongoose';

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true },
);

customerSchema.index({ phoneNormalized: 1 }, {
  unique: true,
  partialFilterExpression: { mergedIntoId: { $exists: false } },
});
customerSchema.index(
  { emailNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      emailNormalized: { $exists: true, $gt: '' },
      mergedIntoId: { $exists: false },
    },
  },
);
customerSchema.index({ businessName: 'text', contactName: 'text' });
customerSchema.index({ isArchived: 1, needsReview: 1, createdAt: -1 });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
