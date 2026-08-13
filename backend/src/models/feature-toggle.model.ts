import mongoose, { Schema, type Document } from 'mongoose';
import type { FeatureToggleKey } from '@dsb/shared';

export interface IFeatureToggle extends Document {
  key: FeatureToggleKey;
  enabled: boolean;
  description: string;
  updatedAt: Date;
}

const featureToggleSchema = new Schema<IFeatureToggle>(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

export const FeatureToggle = mongoose.model<IFeatureToggle>('FeatureToggle', featureToggleSchema);
