import type { GenerateCustomerSummaryResponseDto } from '@dsb/shared';
import { Customer } from '../models/customer.model';
import { AiInsight } from '../models/ai-insight.model';
import {
  addDailyTokenUsage,
  estimateTokenCount,
  getDailyTokenUsage,
  wouldExceedBudget,
} from './ai-budget.service';
import { isProviderConfigured, type AiRuntimeConfig } from './ai-config';
import { resolveProductionAdapter, type AiCompletionAdapter } from './ai-provider';
import {
  buildCustomerSummaryFacts,
  buildCustomerSummaryPrompt,
  fingerprintCustomerFacts,
  hashPrompt,
} from './customer-ai-summary';
import { CustomerError } from './customer.service';
import { AiError } from './enquiry-ai.service';
import { getFeatureMap } from './feature.service';
import { recordAiRun, toAiInsightDto, upsertAiInsight } from './ai-run.service';

export interface GenerateCustomerSummaryDeps {
  config: AiRuntimeConfig;
  adapter?: AiCompletionAdapter | null;
  maxOutputTokens?: number;
}

export async function getCustomerAiSummary(customerId: string) {
  const insight = await AiInsight.findOne({
    kind: 'customer_summary',
    targetType: 'customer',
    targetId: customerId,
  });
  if (!insight) return undefined;
  const customer = await Customer.findById(customerId);
  let stale = false;
  if (customer) {
    const facts = buildCustomerSummaryFacts(customer);
    stale = fingerprintCustomerFacts(facts) !== insight.fingerprint;
  }
  const dto = toAiInsightDto(insight, stale);
  return {
    summary: dto.output,
    fingerprint: dto.fingerprint,
    model: dto.model,
    generatedAt: dto.generatedAt,
    stale: Boolean(dto.stale),
  };
}

export async function generateCustomerSummary(
  customerId: string,
  actorId: string | undefined,
  deps: GenerateCustomerSummaryDeps,
): Promise<GenerateCustomerSummaryResponseDto> {
  const doc = await Customer.findById(customerId);
  if (!doc) throw new CustomerError('NOT_FOUND', 'Customer not found');

  const features = await getFeatureMap();
  if (!features.crm_ai) {
    throw new AiError('AI_DISABLED', 'CRM AI is disabled');
  }

  const adapter = deps.adapter ?? resolveProductionAdapter(deps.config);
  if (!adapter) {
    if (!isProviderConfigured(deps.config)) {
      throw new AiError('AI_NOT_CONFIGURED', 'AI provider is not configured');
    }
    throw new AiError('AI_NOT_CONFIGURED', 'AI provider is not available');
  }

  const maxOutputTokens = deps.maxOutputTokens ?? 800;
  const facts = buildCustomerSummaryFacts(doc);
  const prompt = buildCustomerSummaryPrompt(facts);
  const inputFingerprint = fingerprintCustomerFacts(facts);
  const promptHash = hashPrompt(prompt);

  const used = await getDailyTokenUsage();
  const estimated = estimateTokenCount(prompt) + maxOutputTokens;
  if (wouldExceedBudget(used, estimated, deps.config.dailyTokenBudget)) {
    throw new AiError('AI_BUDGET_EXCEEDED', 'Daily AI token budget is unavailable');
  }

  const started = Date.now();
  let result;
  try {
    result = await adapter.complete({
      kind: 'customer_summary',
      prompt,
      maxOutputTokens,
    });
  } catch (err) {
    await recordAiRun({
      kind: 'customer_summary',
      targetType: 'customer',
      targetId: customerId,
      actorId,
      model: '',
      inputFingerprint,
      output: '',
      promptHash,
      tokenIn: 0,
      tokenOut: 0,
      latencyMs: Date.now() - started,
      status: 'error',
      errorCode: 'AI_PROVIDER_ERROR',
    });
    throw new AiError(
      'AI_PROVIDER_ERROR',
      err instanceof Error ? err.message : 'AI provider failed',
    );
  }

  const summaryText = result.text?.trim() ?? '';
  if (!summaryText) {
    await recordAiRun({
      kind: 'customer_summary',
      targetType: 'customer',
      targetId: customerId,
      actorId,
      model: result.model || '',
      inputFingerprint,
      output: '',
      promptHash,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut,
      latencyMs: Date.now() - started,
      status: 'error',
      errorCode: 'AI_PROVIDER_ERROR',
    });
    throw new AiError('AI_PROVIDER_ERROR', 'AI provider returned an empty summary');
  }

  const tokens = Math.max(0, result.tokenIn) + Math.max(0, result.tokenOut);
  if (tokens > 0) {
    await addDailyTokenUsage(tokens);
  }

  const run = await recordAiRun({
    kind: 'customer_summary',
    targetType: 'customer',
    targetId: customerId,
    actorId,
    model: result.model,
    inputFingerprint,
    output: summaryText,
    promptHash,
    tokenIn: result.tokenIn,
    tokenOut: result.tokenOut,
    latencyMs: Date.now() - started,
    status: 'ok',
  });

  const insight = await upsertAiInsight({
    kind: 'customer_summary',
    targetType: 'customer',
    targetId: customerId,
    output: summaryText,
    fingerprint: inputFingerprint,
    model: result.model,
  });

  return {
    summary: {
      summary: insight.output,
      fingerprint: insight.fingerprint,
      model: insight.model,
      generatedAt: insight.generatedAt,
      stale: false,
    },
    run,
  };
}
