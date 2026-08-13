import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBook extends Document {
  slug: string;
  categoryIds: Types.ObjectId[];
  publishStatus: 'draft' | 'preview' | 'published' | 'archived';
  isFeatured: boolean;
  createdBy?: Types.ObjectId;
}

const bookSchema = new Schema<IBook>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category', index: true }],
    publishStatus: {
      type: String,
      enum: ['draft', 'preview', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Book = mongoose.model<IBook>('Book', bookSchema);
