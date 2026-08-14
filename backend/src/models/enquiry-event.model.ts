import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IEnquiryEvent extends Document {
  enquiryId: Types.ObjectId;
  eventType: string;
  actorId?: Types.ObjectId;
  actorName?: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

const enquiryEventSchema = new Schema<IEnquiryEvent>(
  {
    enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry', required: true },
    eventType: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

enquiryEventSchema.index({ enquiryId: 1, createdAt: 1 });

export const EnquiryEvent = mongoose.model<IEnquiryEvent>('EnquiryEvent', enquiryEventSchema);
