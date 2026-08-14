import type { AiRunKind } from '@dsb/shared';
import { isRealProviderEnabled, type AiRuntimeConfig } from './ai-config';

export interface AiCompletionRequest {
  kind: AiRunKind;
  prompt: string;
  maxOutputTokens: number;
}

export interface AiCompletionResult {
  text: string;
  model: string;
  tokenIn: number;
  tokenOut: number;
}

export interface AiCompletionAdapter {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

/**
 * Live HTTP adapters are not wired in this checkpoint.
 * Even when env looks fully configured, production still has no outbound client.
 */
export function resolveProductionAdapter(_config: AiRuntimeConfig): AiCompletionAdapter | null {
  if (!isRealProviderEnabled(_config)) return null;
  return null;
}
