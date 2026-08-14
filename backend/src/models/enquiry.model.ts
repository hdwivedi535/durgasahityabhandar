import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { EnquirySource } from '@dsb/shared';

export interface IEnquiry extends Document {
  enquiryNumber: string;
  customerId: Types.ObjectId;
  source: EnquirySource;
  statusId: Types.ObjectId;
  priorityId: Types.ObjectId;
  assignedUserId?: Types.ObjectId;
  contactName: string;
  company: string;
  country: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  emailNormalized?: string;
  message: string;
  interestedBookIds: Types.ObjectId[];
  interestedCategoryIds: Types.ObjectId[];
  requirementText?: string;
  subject: string;
  nextFollowUpAt?: Date;
  needsReview: boolean;
  tags: string[];
  isArchived: boolean;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    enquiryNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    source: { type: String, required: true, enum: ['website', 'manual'] },
    statusId: { type: Schema.Types.ObjectId, ref: 'CrmConfig', required: true },
    priorityId: { type: Schema.Types.ObjectId, ref: 'CrmConfig', required: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    contactName: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    country: { type: String, required: true, uppercase: true, trim: true },
    phone: { type: String, required: true },
    phoneNormalized: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    emailNormalized: { type: String, lowercase: true, trim: true },
    message: { type: String, required: true, trim: true },
    interestedBookIds: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
    interestedCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    requirementText: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    nextFollowUpAt: { type: Date },
    needsReview: { type: Boolean, default: false },
    tags: [{ type: String }],
    isArchived: { type: Boolean, default: false },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

enquirySchema.index({ customerId: 1, createdAt: -1 });
enquirySchema.index({ statusId: 1, createdAt: -1 });
enquirySchema.index({ assignedUserId: 1 });
enquirySchema.index({ source: 1 });
enquirySchema.index({ needsReview: 1 });
enquirySchema.index({ nextFollowUpAt: 1 });
enquirySchema.index({ enquiryNumber: 'text', subject: 'text', message: 'text', requirementText: 'text' });

export const Enquiry = mongoose.model<IEnquiry>('Enquiry', enquirySchema);
