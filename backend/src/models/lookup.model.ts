import mongoose, { Schema, type Document } from 'mongoose';
import type { LookupKind } from '@dsb/shared';

export interface ILookup extends Document {
  kind: LookupKind;
  slug: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const lookupSchema = new Schema<ILookup>(
  {
    kind: {
      type: String,
      required: true,
      enum: ['pageType', 'bindingType', 'subject', 'tag', 'availability'],
      index: true,
    },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

lookupSchema.index({ kind: 1, slug: 1 }, { unique: true });

export const Lookup = mongoose.model<ILookup>('Lookup', lookupSchema);
