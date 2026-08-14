import { AiTokenCounter } from '../models/ai-token-counter.model';

export function utcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Rough token estimate for pre-flight budget checks (no tokenizer / no provider). */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Budget 0 (default) blocks any token use until a daily budget is approved. */
export function wouldExceedBudget(tokensUsed: number, adding: number, dailyBudget: number): boolean {
  if (adding <= 0) return false;
  if (dailyBudget <= 0) return true;
  return tokensUsed + adding > dailyBudget;
}

export async function getDailyTokenUsage(dateKey = utcDateKey()): Promise<number> {
  const doc = await AiTokenCounter.findOne({ dateKey });
  return doc?.tokensUsed ?? 0;
}

export async function addDailyTokenUsage(tokens: number, dateKey = utcDateKey()): Promise<number> {
  const doc = await AiTokenCounter.findOneAndUpdate(
    { dateKey },
    { $inc: { tokensUsed: tokens } },
    { upsert: true, new: true },
  );
  return doc?.tokensUsed ?? tokens;
}
