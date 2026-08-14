export interface IdentityInput {
  phoneNormalized: string;
  emailNormalized?: string;
}

export interface MatchCandidate {
  id: string;
  phoneNormalized: string;
  emailNormalized?: string;
  mergedIntoId?: string;
}

export interface ScoredMatch {
  customerId: string;
  score: number;
  reasons: string[];
}

export type MatchDecision =
  | { kind: 'none' }
  | { kind: 'exact'; match: ScoredMatch }
  | { kind: 'ambiguous'; matches: ScoredMatch[] };

export type PublicCreatePolicy = 'link' | 'create' | 'create_needs_review';

export function followMergedId(
  id: string,
  byId: Map<string, MatchCandidate>,
): string {
  let current = id;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(current)) return current;
    seen.add(current);
    const row = byId.get(current);
    if (!row?.mergedIntoId) return current;
    current = row.mergedIntoId;
  }
}

function scoreCandidate(input: IdentityInput, candidate: MatchCandidate): ScoredMatch | null {
  const reasons: string[] = [];
  let score = 0;
  if (candidate.phoneNormalized === input.phoneNormalized) {
    score = 100;
    reasons.push('phone');
  }
  if (
    input.emailNormalized &&
    candidate.emailNormalized &&
    candidate.emailNormalized === input.emailNormalized
  ) {
    if (score < 80) score = 80;
    reasons.push('email');
  }
  if (score === 0) return null;
  return { customerId: candidate.id, score, reasons };
}

export function decideMatch(input: IdentityInput, candidates: MatchCandidate[]): MatchDecision {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const unmerged = candidates.filter((c) => !c.mergedIntoId);

  const phoneHits = new Set<string>();
  const emailHits = new Set<string>();
  const scored: ScoredMatch[] = [];

  for (const candidate of unmerged) {
    const hit = scoreCandidate(input, candidate);
    if (!hit) continue;
    const survivorId = followMergedId(hit.customerId, byId);
    const survivorHit = { ...hit, customerId: survivorId };
    scored.push(survivorHit);
    if (survivorHit.reasons.includes('phone')) phoneHits.add(survivorId);
    if (survivorHit.reasons.includes('email')) emailHits.add(survivorId);
  }

  const uniqueIds = [...new Set(scored.map((s) => s.customerId))];
  if (uniqueIds.length === 0) return { kind: 'none' };

  const phoneList = [...phoneHits];
  const emailList = [...emailHits];
  if (phoneList.length === 1 && emailList.length === 1 && phoneList[0] !== emailList[0]) {
    const matches = uniqueIds.map((id) => {
      const best = scored.filter((s) => s.customerId === id).sort((a, b) => b.score - a.score)[0];
      return best;
    });
    return { kind: 'ambiguous', matches };
  }

  if (uniqueIds.length === 1) {
    const match = scored.sort((a, b) => b.score - a.score)[0];
    return { kind: 'exact', match };
  }

  return {
    kind: 'ambiguous',
    matches: uniqueIds.map(
      (id) => scored.filter((s) => s.customerId === id).sort((a, b) => b.score - a.score)[0],
    ),
  };
}

export function publicCreatePolicy(decision: MatchDecision): PublicCreatePolicy {
  if (decision.kind === 'exact') return 'link';
  if (decision.kind === 'ambiguous') return 'create_needs_review';
  return 'create';
}
