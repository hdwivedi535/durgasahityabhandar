import mongoose, { Schema, type Document } from 'mongoose';
import type { HomepageSectionType } from '@dsb/shared';

export interface IHomepageSection extends Document {
  type: HomepageSectionType;
  sortOrder: number;
  isVisible: boolean;
  publishStatus: 'draft' | 'published';
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const homepageSectionSchema = new Schema<IHomepageSection>(
  {
    type: {
      type: String,
      required: true,
      enum: ['hero', 'featured_books', 'categories', 'custom_content'],
    },
    sortOrder: { type: Number, default: 0, index: true },
    isVisible: { type: Boolean, default: true },
    publishStatus: { type: String, enum: ['draft', 'published'], default: 'draft' },
    config: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

export const HomepageSection = mongoose.model<IHomepageSection>(
  'HomepageSection',
  homepageSectionSchema,
);
