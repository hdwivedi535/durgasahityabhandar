import type { AiProvider } from '@dsb/shared';

export interface AiRuntimeConfig {
  provider: AiProvider;
  hasApiKey: boolean;
  dailyTokenBudget: number;
}

/** Real outbound calls stay off until provider, key, and a positive daily budget are all set. */
export function isRealProviderEnabled(config: AiRuntimeConfig): boolean {
  return config.provider !== 'none' && config.hasApiKey && config.dailyTokenBudget > 0;
}
