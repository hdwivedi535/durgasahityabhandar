import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  const { Customer } = await import('../models/customer.model');
  try {
    await Customer.collection.dropIndex('country_1_phoneNormalized_1');
  } catch {
    // Index may already be gone on new environments.
  }
  await Customer.syncIndexes();
  console.log('Connected to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
