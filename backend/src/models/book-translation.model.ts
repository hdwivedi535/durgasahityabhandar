import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { BookSeo } from '@dsb/shared';

export interface IBookTranslation extends Document {
  bookId: Types.ObjectId;
  languageCode: string;
  title: string;
  slug: string;
  author?: string;
  translator?: string;
  commentator?: string;
  shortDescription?: string;
  detailedDescription?: string;
  contentHighlights?: string[];
  seo?: BookSeo;
}

const seoSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
    indexable: { type: Boolean, default: true },
  },
  { _id: false },
);

const bookTranslationSchema = new Schema<IBookTranslation>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    languageCode: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    author: { type: String, trim: true },
    translator: { type: String, trim: true },
    commentator: { type: String, trim: true },
    shortDescription: { type: String, trim: true },
    detailedDescription: { type: String, trim: true },
    contentHighlights: [{ type: String, trim: true }],
    seo: { type: seoSchema, default: () => ({ indexable: true }) },
  },
  { timestamps: true },
);

bookTranslationSchema.index({ bookId: 1, languageCode: 1 }, { unique: true });
bookTranslationSchema.index({ languageCode: 1, slug: 1 }, { unique: true });
bookTranslationSchema.index({ title: 'text', author: 'text' });

export const BookTranslation = mongoose.model<IBookTranslation>(
  'BookTranslation',
  bookTranslationSchema,
);
