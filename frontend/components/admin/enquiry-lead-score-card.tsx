import type { EnquiryDto } from '@dsb/shared';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const BAND_LABEL: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

function bandLabel(slug?: string): string {
  if (!slug) return '—';
  return BAND_LABEL[slug] ?? slug;
}

interface EnquiryLeadScoreCardProps {
  enquiry: EnquiryDto;
}

export function EnquiryLeadScoreCard({ enquiry }: EnquiryLeadScoreCardProps) {
  const crmPriority = enquiry.priority?.name ?? bandLabel(enquiry.priority?.slug);
  const score = enquiry.leadScore;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-medium">Priority and score</h2>
        <p className="mt-1 text-xs text-muted">
          CRM priority is set by the agent. The heuristic score is a separate suggestion and does not
          change CRM priority.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">CRM priority</p>
          <p className="mt-0.5 text-base font-medium" data-testid="crm-priority">
            {crmPriority || '—'}
          </p>
        </div>
        {score ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Heuristic score</p>
                <p className="mt-0.5 text-base font-medium" data-testid="heuristic-score">
                  {score.score}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Suggested band</p>
                <p className="mt-0.5 text-base font-medium" data-testid="suggested-band">
                  {bandLabel(score.suggestedPriority)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Why</p>
              {score.reasons.length === 0 ? (
                <p className="mt-1 text-muted">No extra signals beyond the base score.</p>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-5" data-testid="score-reasons">
                  {score.reasons.map((reason) => (
                    <li key={reason.code}>
                      {reason.label}
                      <span className="text-muted">
                        {' '}
                        ({reason.points > 0 ? '+' : ''}
                        {reason.points})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted">Heuristic score is not available for this enquiry.</p>
        )}
      </CardContent>
    </Card>
  );
}
