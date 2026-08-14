import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICustomerEvent extends Document {
  customerId: Types.ObjectId;
  eventType: string;
  actorId?: Types.ObjectId;
  actorName?: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

const customerEventSchema = new Schema<ICustomerEvent>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    eventType: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

customerEventSchema.index({ customerId: 1, createdAt: 1 });

export const CustomerEvent = mongoose.model<ICustomerEvent>('CustomerEvent', customerEventSchema);
