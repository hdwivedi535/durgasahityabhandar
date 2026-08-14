import type { AiInsightDto, AiRunDto } from '@dsb/shared';
import { AiInsight, type IAiInsight } from '../models/ai-insight.model';
import { AiRun, type IAiRun } from '../models/ai-run.model';

export function toAiRunDto(doc: IAiRun): AiRunDto {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    targetType: doc.targetType,
    targetId: doc.targetId.toString(),
    actorId: doc.actorId?.toString(),
    model: doc.modelName,
    inputFingerprint: doc.inputFingerprint,
    output: doc.output,
    promptHash: doc.promptHash,
    tokenIn: doc.tokenIn,
    tokenOut: doc.tokenOut,
    latencyMs: doc.latencyMs,
    status: doc.status,
    errorCode: doc.errorCode,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toAiInsightDto(doc: IAiInsight, stale?: boolean): AiInsightDto {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    targetType: doc.targetType,
    targetId: doc.targetId.toString(),
    output: doc.output,
    fingerprint: doc.fingerprint,
    model: doc.modelName,
    generatedAt: doc.generatedAt.toISOString(),
    stale,
  };
}

export async function recordAiRun(input: {
  kind: IAiRun['kind'];
  targetType: IAiRun['targetType'];
  targetId: string;
  actorId?: string;
  model: string;
  inputFingerprint: string;
  output: string;
  promptHash: string;
  tokenIn: number;
  tokenOut: number;
  latencyMs: number;
  status: IAiRun['status'];
  errorCode?: string;
}): Promise<AiRunDto> {
  const doc = await AiRun.create({
    kind: input.kind,
    targetType: input.targetType,
    targetId: input.targetId,
    actorId: input.actorId,
    modelName: input.model,
    inputFingerprint: input.inputFingerprint,
    output: input.output,
    promptHash: input.promptHash,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    latencyMs: input.latencyMs,
    status: input.status,
    errorCode: input.errorCode,
  });
  return toAiRunDto(doc);
}

export async function upsertAiInsight(input: {
  kind: IAiInsight['kind'];
  targetType: IAiInsight['targetType'];
  targetId: string;
  output: string;
  fingerprint: string;
  model: string;
  generatedAt?: Date;
}): Promise<AiInsightDto> {
  const doc = await AiInsight.findOneAndUpdate(
    { kind: input.kind, targetType: input.targetType, targetId: input.targetId },
    {
      output: input.output,
      fingerprint: input.fingerprint,
      modelName: input.model,
      generatedAt: input.generatedAt ?? new Date(),
    },
    { upsert: true, new: true },
  );
  if (!doc) {
    throw new Error('Failed to upsert AI insight');
  }
  return toAiInsightDto(doc);
}
