import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { AiRunKind, AiRunStatus, AiTargetType } from '@dsb/shared';

export interface IAiRun extends Document {
  kind: AiRunKind;
  targetType: AiTargetType;
  targetId: Types.ObjectId;
  actorId?: Types.ObjectId;
  modelName: string;
  inputFingerprint: string;
  output: string;
  promptHash: string;
  tokenIn: number;
  tokenOut: number;
  latencyMs: number;
  status: AiRunStatus;
  errorCode?: string;
  createdAt: Date;
}

const aiRunSchema = new Schema<IAiRun>(
  {
    kind: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    modelName: { type: String, required: true, default: '' },
    inputFingerprint: { type: String, required: true, default: '' },
    output: { type: String, default: '' },
    promptHash: { type: String, required: true, default: '' },
    tokenIn: { type: Number, required: true, default: 0 },
    tokenOut: { type: Number, required: true, default: 0 },
    latencyMs: { type: Number, required: true, default: 0 },
    status: { type: String, required: true, enum: ['ok', 'error'] },
    errorCode: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiRunSchema.index({ targetType: 1, targetId: 1, kind: 1, createdAt: -1 });
aiRunSchema.index({ createdAt: -1 });

export const AiRun = mongoose.model<IAiRun>('AiRun', aiRunSchema);
