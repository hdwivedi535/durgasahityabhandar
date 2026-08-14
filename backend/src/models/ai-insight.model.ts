import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { AiRunKind, AiTargetType } from '@dsb/shared';

export interface IAiInsight extends Document {
  kind: AiRunKind;
  targetType: AiTargetType;
  targetId: Types.ObjectId;
  output: string;
  fingerprint: string;
  modelName: string;
  generatedAt: Date;
}

const aiInsightSchema = new Schema<IAiInsight>(
  {
    kind: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    output: { type: String, required: true, default: '' },
    fingerprint: { type: String, required: true, default: '' },
    modelName: { type: String, required: true, default: '' },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

aiInsightSchema.index({ targetType: 1, targetId: 1, kind: 1 }, { unique: true });

export const AiInsight = mongoose.model<IAiInsight>('AiInsight', aiInsightSchema);
