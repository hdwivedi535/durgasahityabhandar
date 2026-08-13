import mongoose, { Schema, type Document } from 'mongoose';
import type { CmsPageTranslation, CmsPublishStatus } from '@dsb/shared';

export interface ICmsPage extends Document {
  slug: string;
  status: CmsPublishStatus;
  isVisible: boolean;
  translations: CmsPageTranslation[];
  createdAt: Date;
  updatedAt: Date;
}

const translationSchema = new Schema(
  {
    languageCode: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
  },
  { _id: false },
);

const cmsPageSchema = new Schema<ICmsPage>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['draft', 'published', 'hidden'], default: 'draft' },
    isVisible: { type: Boolean, default: true },
    translations: { type: [translationSchema], default: [] },
  },
  { timestamps: true },
);

export const CmsPage = mongoose.model<ICmsPage>('CmsPage', cmsPageSchema);
