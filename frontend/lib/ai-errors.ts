import { ApiClientError } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';

const AI_ACTION_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'You do not have permission to generate AI summaries.',
  AI_FORBIDDEN: 'You do not have permission to generate AI summaries.',
  AI_DISABLED: 'CRM AI is currently disabled. Summaries cannot be generated until it is enabled.',
  AI_NOT_CONFIGURED: 'AI is not configured yet. Summaries cannot be generated.',
  AI_BUDGET_EXCEEDED: 'The daily AI token budget has been reached. Try again later.',
  AI_RATE_LIMITED: 'Too many AI requests. Try again shortly.',
  AI_TIMEOUT: 'The summary request timed out. Try again.',
  AI_PROVIDER_ERROR: 'Could not generate a summary. Try again later.',
};

export function getAiActionMessage(error: unknown, fallback = 'Could not generate a summary.'): string {
  if (error instanceof ApiClientError && AI_ACTION_MESSAGES[error.code]) {
    return AI_ACTION_MESSAGES[error.code];
  }
  return getErrorMessage(error, fallback);
}
