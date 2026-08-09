export type ProficiencyRank = 0 | 0.5 | 1 | 2;

export interface ProficiencyClaim {
  targetId: string;
  rank: ProficiencyRank;
  sourceId: string;
  replaceableChoiceId?: string;
}

export interface ProficiencyResolution {
  targetId: string;
  effectiveRank: ProficiencyRank;
  claims: ProficiencyClaim[];
  duplicateSourceIds: string[];
  replaceableChoiceIds: string[];
}

export function resolveProficiencyClaims(claims: readonly ProficiencyClaim[]): ProficiencyResolution[] {
  const grouped = new Map<string, ProficiencyClaim[]>();
  for (const claim of claims) {
    const list = grouped.get(claim.targetId) ?? [];
    list.push({ ...claim });
    grouped.set(claim.targetId, list);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([targetId, targetClaims]) => {
      const effectiveRank = Math.max(0, ...targetClaims.map((claim) => claim.rank)) as ProficiencyRank;
      return {
        targetId,
        effectiveRank,
        claims: targetClaims,
        duplicateSourceIds: targetClaims.length > 1 ? targetClaims.slice(1).map((claim) => claim.sourceId) : [],
        replaceableChoiceIds: [...new Set(targetClaims.flatMap((claim) => claim.replaceableChoiceId ? [claim.replaceableChoiceId] : []))]
      };
    });
}

export function proficiencyContribution(rank: ProficiencyRank, proficiencyBonus: number): number {
  if (!Number.isFinite(proficiencyBonus) || proficiencyBonus < 0) throw new RangeError("Proficiency Bonus must be non-negative");
  return Math.floor(rank === 0.5 ? proficiencyBonus / 2 : proficiencyBonus * rank);
}

