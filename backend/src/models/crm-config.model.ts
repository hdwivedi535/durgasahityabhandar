import mongoose, { Schema, type Document } from 'mongoose';
import type { CrmConfigKind } from '@dsb/shared';

export interface ICrmConfig extends Document {
  kind: CrmConfigKind;
  slug: string;
  name: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
  isTerminal: boolean;
  publicLabel?: string;
}

const crmConfigSchema = new Schema<ICrmConfig>(
  {
    kind: { type: String, required: true, enum: ['enquiryStatus', 'enquiryPriority'] },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#64748b' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: false },
    isTerminal: { type: Boolean, default: false },
    publicLabel: { type: String, trim: true },
  },
  { timestamps: true },
);

crmConfigSchema.index({ kind: 1, slug: 1 }, { unique: true });
crmConfigSchema.index({ kind: 1, displayOrder: 1 });

export const CrmConfig = mongoose.model<ICrmConfig>('CrmConfig', crmConfigSchema);
