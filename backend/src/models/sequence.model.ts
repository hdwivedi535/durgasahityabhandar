import mongoose, { Schema, type Document } from 'mongoose';

export interface ISequence extends Document {
  name: string;
  year?: number;
  sequence: number;
}

const sequenceSchema = new Schema<ISequence>({
  name: { type: String, required: true },
  year: { type: Number },
  sequence: { type: Number, required: true, default: 0 },
});

sequenceSchema.index({ name: 1, year: 1 }, { unique: true });

export const Sequence = mongoose.model<ISequence>('Sequence', sequenceSchema);
