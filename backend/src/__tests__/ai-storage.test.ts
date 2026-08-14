import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { FeatureToggle } from '../models/feature-toggle.model';
import { AiRun } from '../models/ai-run.model';
import { AiInsight } from '../models/ai-insight.model';
import { AiTokenCounter } from '../models/ai-token-counter.model';
import { ensureFeatureToggles, listFeatureToggles } from '../services/feature.service';
import { addDailyTokenUsage, getDailyTokenUsage } from '../services/ai-budget.service';
import { recordAiRun, upsertAiInsight } from '../services/ai-run.service';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { version: '6.0.14' },
    instance: { launchTimeout: 120_000 },
  });
  await mongoose.connect(mongo.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    FeatureToggle.deleteMany({}),
    AiRun.deleteMany({}),
    AiInsight.deleteMany({}),
    AiTokenCounter.deleteMany({}),
  ]);
});

describe('crm_ai toggle', () => {
  it('seeds crm_ai disabled by default', async () => {
    await ensureFeatureToggles();
    const items = await listFeatureToggles();
    const crmAi = items.find((i) => i.key === 'crm_ai');
    expect(crmAi?.enabled).toBe(false);
  });
});

describe('AI audit and budget storage', () => {
  it('records an AiRun and upserts an insight without calling a provider', async () => {
    const targetId = new mongoose.Types.ObjectId().toString();
    const run = await recordAiRun({
      kind: 'enquiry_summary',
      targetType: 'enquiry',
      targetId,
      model: 'mock',
      inputFingerprint: 'fp1',
      output: 'Short summary',
      promptHash: 'hash',
      tokenIn: 0,
      tokenOut: 0,
      latencyMs: 1,
      status: 'ok',
    });
    expect(run.id).toBeTruthy();
    expect(run.kind).toBe('enquiry_summary');

    const insight = await upsertAiInsight({
      kind: 'enquiry_summary',
      targetType: 'enquiry',
      targetId,
      output: 'Short summary',
      fingerprint: 'fp1',
      model: 'mock',
    });
    expect(insight.output).toBe('Short summary');

    const again = await upsertAiInsight({
      kind: 'enquiry_summary',
      targetType: 'enquiry',
      targetId,
      output: 'Updated summary',
      fingerprint: 'fp2',
      model: 'mock',
    });
    expect(again.id).toBe(insight.id);
    expect(again.output).toBe('Updated summary');
    expect(await AiInsight.countDocuments()).toBe(1);
  });

  it('increments daily token usage', async () => {
    expect(await getDailyTokenUsage('2026-08-14')).toBe(0);
    expect(await addDailyTokenUsage(12, '2026-08-14')).toBe(12);
    expect(await addDailyTokenUsage(8, '2026-08-14')).toBe(20);
  });
});
