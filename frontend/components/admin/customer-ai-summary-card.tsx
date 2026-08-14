import type { CustomerAiSummaryDto } from '@dsb/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface CustomerAiSummaryCardProps {
  summary?: CustomerAiSummaryDto;
  canGenerate: boolean;
  generating: boolean;
  error?: string;
  onGenerate: () => void;
}

export function CustomerAiSummaryCard({
  summary,
  canGenerate,
  generating,
  error,
  onGenerate,
}: CustomerAiSummaryCardProps) {
  const hasSummary = Boolean(summary?.summary);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">AI summary</h2>
          <p className="mt-1 text-xs text-muted">
            Internal customer intelligence. Generated from existing customer data only.
          </p>
        </div>
        {canGenerate && (
          <Button
            type="button"
            variant={hasSummary ? 'secondary' : 'primary'}
            size="sm"
            loading={generating}
            onClick={onGenerate}
            aria-busy={generating}
          >
            {hasSummary ? 'Regenerate summary' : 'Generate summary'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {generating && !hasSummary && (
          <p className="text-muted" data-testid="summary-loading">
            Generating summary…
          </p>
        )}
        {hasSummary ? (
          <div>
            <p className="whitespace-pre-wrap" data-testid="ai-summary-text">
              {summary?.summary}
            </p>
            {summary?.generatedAt && (
              <p className="mt-2 text-xs text-muted">
                Generated {new Date(summary.generatedAt).toLocaleString()}
                {summary.model ? ` · ${summary.model}` : ''}
              </p>
            )}
            {summary?.stale && (
              <p className="mt-2 text-xs text-amber-700">
                The customer has changed since this summary was generated.
              </p>
            )}
          </div>
        ) : (
          !generating && (
            <p className="text-muted" data-testid="ai-summary-empty">
              {canGenerate
                ? 'No AI summary yet. Generate one to get a concise internal overview.'
                : 'No AI summary yet.'}
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
