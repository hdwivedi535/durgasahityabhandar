import { Sequence } from '../models/sequence.model';

export async function nextSequence(name: string, year?: number): Promise<number> {
  const filter = year == null ? { name, year: { $exists: false } } : { name, year };
  const doc = await Sequence.findOneAndUpdate(
    filter,
    { $inc: { sequence: 1 }, $setOnInsert: year == null ? { name } : { name, year } },
    { upsert: true, new: true },
  );
  return doc.sequence;
}

export async function nextCustomerNumber(): Promise<string> {
  const n = await nextSequence('customer');
  return `CUST-${String(n).padStart(5, '0')}`;
}

export async function nextEnquiryNumber(date = new Date()): Promise<string> {
  const year = date.getUTCFullYear();
  const n = await nextSequence('enquiry', year);
  return `ENQ-${year}-${String(n).padStart(4, '0')}`;
}
