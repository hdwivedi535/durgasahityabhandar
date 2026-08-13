import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type {
  BookCommercial,
  BookFieldVisibility,
  BookPhysical,
  BookPriceVisibility,
  BookPublishStatus,
  BookPublishing,
} from '@dsb/shared';

export interface IBook extends Document {
  sku?: string;
  categoryIds: Types.ObjectId[];
  subjectIds: Types.ObjectId[];
  tagIds: Types.ObjectId[];
  languageId?: Types.ObjectId;
  availabilityId?: Types.ObjectId;
  physical: BookPhysical;
  publishing: BookPublishing;
  commercial: BookCommercial;
  fieldVisibility: BookFieldVisibility;
  priceVisibility: BookPriceVisibility;
  /** Ordered image URLs (max 3). Index 0 = primary/cover. Option A storage. */
  imageUrls: string[];
  coverMediaId?: Types.ObjectId;
  galleryMediaIds: Types.ObjectId[];
  isFeatured: boolean;
  publishStatus: BookPublishStatus;
  publishedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const physicalSchema = new Schema(
  {
    pages: { type: Number },
    pageTypeId: { type: Schema.Types.ObjectId },
    gsm: { type: Number },
    weightGrams: { type: Number },
    lengthMm: { type: Number },
    widthMm: { type: Number },
    heightMm: { type: Number },
    bindingTypeId: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const publishingSchema = new Schema(
  {
    isbn: { type: String, trim: true },
    edition: { type: String, trim: true },
    publicationYear: { type: Number },
    publisher: { type: String, trim: true },
  },
  { _id: false },
);

const commercialSchema = new Schema(
  {
    mrp: { type: Number },
    wholesalePrice: { type: Number },
    moq: { type: Number },
    currency: { type: String, default: 'INR', trim: true },
  },
  { _id: false },
);

const fieldVisibilitySchema = new Schema(
  {
    physical: { type: Boolean, default: true },
    publishing: { type: Boolean, default: true },
    commercial: { type: Boolean, default: false },
    author: { type: Boolean, default: true },
    translator: { type: Boolean, default: true },
  },
  { _id: false },
);

const priceVisibilitySchema = new Schema(
  {
    showMrp: { type: Boolean, default: false },
    showWholesale: { type: Boolean, default: true },
    showMoq: { type: Boolean, default: true },
  },
  { _id: false },
);

const bookSchema = new Schema<IBook>(
  {
    sku: { type: String, trim: true, sparse: true, unique: true },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category', index: true }],
    subjectIds: [{ type: Schema.Types.ObjectId }],
    tagIds: [{ type: Schema.Types.ObjectId }],
    languageId: { type: Schema.Types.ObjectId },
    availabilityId: { type: Schema.Types.ObjectId },
    physical: { type: physicalSchema, default: () => ({}) },
    publishing: { type: publishingSchema, default: () => ({}) },
    commercial: { type: commercialSchema, default: () => ({ currency: 'INR' }) },
    fieldVisibility: { type: fieldVisibilitySchema, default: () => ({}) },
    priceVisibility: { type: priceVisibilitySchema, default: () => ({}) },
    imageUrls: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length <= 3,
        message: 'A book may have at most 3 image URLs',
      },
    },
    coverMediaId: { type: Schema.Types.ObjectId, ref: 'Media' },
    galleryMediaIds: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
    isFeatured: { type: Boolean, default: false, index: true },
    publishStatus: {
      type: String,
      enum: ['draft', 'preview', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

bookSchema.index({ 'publishing.isbn': 1 });

export const Book = mongoose.model<IBook>('Book', bookSchema);
