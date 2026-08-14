import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  const { Customer } = await import('../models/customer.model');
  await Customer.updateMany(
    { $or: [{ needsReview: { $exists: false } }, { needsReview: null }] },
    { $set: { needsReview: false } },
  );
  const legacyOrIncompatible = [
    'country_1_phoneNormalized_1',
    'phoneNormalized_1',
    'emailNormalized_1',
  ];
  for (const name of legacyOrIncompatible) {
    try {
      await Customer.collection.dropIndex(name);
    } catch {
      // Index may not exist yet, or may already have been replaced.
    }
  }
  await Customer.syncIndexes();
  console.log('Connected to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
