import mongoose, { Schema, type Document } from 'mongoose';

export interface IAiTokenCounter extends Document {
  dateKey: string;
  tokensUsed: number;
}

const aiTokenCounterSchema = new Schema<IAiTokenCounter>(
  {
    dateKey: { type: String, required: true, unique: true },
    tokensUsed: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const AiTokenCounter = mongoose.model<IAiTokenCounter>('AiTokenCounter', aiTokenCounterSchema);
