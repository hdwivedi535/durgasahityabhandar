import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { CategorySeo, CategoryStatus, CategoryTranslation } from '@dsb/shared';

export interface ICategory extends Document {
  parentId: Types.ObjectId | null;
  ancestorIds: Types.ObjectId[];
  slug: string;
  status: CategoryStatus;
  isVisible: boolean;
  isFeatured: boolean;
  displayOrder: number;
  imageMediaId?: Types.ObjectId;
  iconMediaId?: Types.ObjectId;
  translations: CategoryTranslation[];
  seo: CategorySeo;
  archivedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const translationSchema = new Schema(
  {
    languageCode: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false },
);

const seoSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
    socialTitle: { type: String, trim: true },
    socialDescription: { type: String, trim: true },
    socialImageMediaId: { type: Schema.Types.ObjectId, ref: 'Media' },
    canonicalUrl: { type: String, trim: true },
    indexable: { type: Boolean, default: true },
  },
  { _id: false },
);

const categorySchema = new Schema<ICategory>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    ancestorIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'hidden', 'archived'],
      default: 'draft',
      index: true,
    },
    isVisible: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    displayOrder: { type: Number, default: 0, index: true },
    imageMediaId: { type: Schema.Types.ObjectId, ref: 'Media' },
    iconMediaId: { type: Schema.Types.ObjectId, ref: 'Media' },
    translations: { type: [translationSchema], default: [] },
    seo: { type: seoSchema, default: () => ({ indexable: true }) },
    archivedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

categorySchema.index({ 'translations.name': 'text', slug: 'text' });
categorySchema.index({ ancestorIds: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
