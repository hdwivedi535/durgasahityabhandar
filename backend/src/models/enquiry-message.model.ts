import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { EnquiryMessageChannel, EnquiryMessageType } from '@dsb/shared';

export interface IEnquiryMessage extends Document {
  enquiryId: Types.ObjectId;
  type: EnquiryMessageType;
  channel: EnquiryMessageChannel;
  content: string;
  authorId?: Types.ObjectId;
  authorName: string;
  createdAt: Date;
}

const enquiryMessageSchema = new Schema<IEnquiryMessage>(
  {
    enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry', required: true },
    type: { type: String, required: true, enum: ['customer', 'agent', 'internal_note'] },
    channel: { type: String, required: true, enum: ['website', 'crm'] },
    content: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

enquiryMessageSchema.index({ enquiryId: 1, createdAt: 1 });

export const EnquiryMessage = mongoose.model<IEnquiryMessage>(
  'EnquiryMessage',
  enquiryMessageSchema,
);
