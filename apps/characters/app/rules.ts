export const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];
export type AbilityScores = Record<AbilityId, number>;

const POINT_BUY_COSTS: Readonly<Record<number, number>> = Object.freeze({
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
});

export function abilityModifier(score: number): number {
  if (!Number.isInteger(score) || score < 1) throw new RangeError("Ability score must be a positive integer");
  return Math.floor((score - 10) / 2);
}

export function validatePointBuy(scores: AbilityScores, budget = 27) {
  const errors: string[] = [];
  let cost = 0;
  for (const ability of ABILITY_IDS) {
    const score = scores[ability];
    if (!Number.isInteger(score) || POINT_BUY_COSTS[score] === undefined) {
      errors.push(ability + " must be an integer from 8 to 15");
      continue;
    }
    cost += POINT_BUY_COSTS[score];
  }
  if (cost > budget) errors.push("Point Buy exceeds its budget");
  return { valid: errors.length === 0, cost, remaining: budget - cost, errors };
}
