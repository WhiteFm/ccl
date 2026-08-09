import { ABILITY_IDS, type AbilityId, type AbilityScores } from "../../content-schema/src/types.ts";

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_COSTS: Readonly<Record<number, number>> = Object.freeze({
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
});

export interface PointBuyValidation {
  valid: boolean;
  cost: number;
  remaining: number;
  errors: string[];
}

export interface AbilityRoll {
  id: string;
  dice: readonly [number, number, number, number];
  discardedIndex: number;
  total: number;
}

export interface AssignedAbilityRoll extends AbilityRoll {
  assignedAbility: AbilityId;
}

export type RandomSource = () => number;

export function abilityModifier(score: number): number {
  if (!Number.isInteger(score) || score < 1) throw new RangeError("Ability score must be a positive integer");
  return Math.floor((score - 10) / 2);
}

export function validatePointBuy(scores: AbilityScores, budget = POINT_BUY_BUDGET): PointBuyValidation {
  const errors: string[] = [];
  const keys = Object.keys(scores).sort();
  const expected = [...ABILITY_IDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    errors.push("Exactly six standard abilities are required");
  }

  let cost = 0;
  for (const ability of ABILITY_IDS) {
    const score = scores[ability];
    if (!Number.isInteger(score) || POINT_BUY_COSTS[score] === undefined) {
      errors.push(`${ability} must be an integer from 8 to 15`);
      continue;
    }
    cost += POINT_BUY_COSTS[score];
  }
  if (cost > budget) errors.push(`Point Buy cost ${cost} exceeds budget ${budget}`);

  return {
    valid: errors.length === 0,
    cost,
    remaining: budget - cost,
    errors
  };
}

export function resolveAbilityRoll(id: string, dice: readonly number[]): AbilityRoll {
  if (dice.length !== 4 || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) {
    throw new RangeError("An ability roll requires exactly four d6 results");
  }
  const minimum = Math.min(...dice);
  const discardedIndex = dice.indexOf(minimum);
  const total = dice.reduce((sum, die, index) => sum + (index === discardedIndex ? 0 : die), 0);
  return {
    id,
    dice: [dice[0], dice[1], dice[2], dice[3]],
    discardedIndex,
    total
  };
}

export function generateAbilityRolls(random: RandomSource = Math.random): AbilityRoll[] {
  const rolls: AbilityRoll[] = [];
  for (let rollIndex = 0; rollIndex < 6; rollIndex += 1) {
    const dice = Array.from({ length: 4 }, () => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("Random source must return a value in [0, 1)");
      return Math.floor(value * 6) + 1;
    });
    rolls.push(resolveAbilityRoll(`roll-${rollIndex + 1}`, dice));
  }
  return rolls;
}

export function assignAbilityRolls(rolls: readonly AbilityRoll[], assignments: Readonly<Record<string, AbilityId>>): AssignedAbilityRoll[] {
  if (rolls.length !== 6) throw new RangeError("Exactly six ability rolls are required");
  const rollIds = new Set<string>();
  const abilities = new Set<AbilityId>();
  const result = rolls.map((roll) => {
    if (rollIds.has(roll.id)) throw new Error(`Duplicate roll id ${roll.id}`);
    rollIds.add(roll.id);
    const assignedAbility = assignments[roll.id];
    if (!assignedAbility || !ABILITY_IDS.includes(assignedAbility)) throw new Error(`Roll ${roll.id} is not assigned to a valid ability`);
    if (abilities.has(assignedAbility)) throw new Error(`Ability ${assignedAbility} has more than one roll`);
    abilities.add(assignedAbility);
    return { ...roll, assignedAbility };
  });
  if (abilities.size !== ABILITY_IDS.length) throw new Error("Every ability must receive exactly one roll");
  return result;
}

export function scoresFromAssignedRolls(rolls: readonly AssignedAbilityRoll[]): AbilityScores {
  if (rolls.length !== 6) throw new RangeError("Exactly six assigned rolls are required");
  const scores = {} as AbilityScores;
  for (const roll of rolls) {
    if (scores[roll.assignedAbility] !== undefined) throw new Error(`Ability ${roll.assignedAbility} is assigned more than once`);
    scores[roll.assignedAbility] = roll.total;
  }
  for (const ability of ABILITY_IDS) {
    if (scores[ability] === undefined) throw new Error(`Ability ${ability} has no assigned roll`);
  }
  return scores;
}

export function validateBackgroundAbilityBonuses(
  eligibleAbilities: readonly AbilityId[],
  bonuses: Readonly<Partial<Record<AbilityId, number>>>
): string[] {
  const errors: string[] = [];
  const eligible = new Set(eligibleAbilities);
  if (eligible.size !== 3) errors.push("A background must provide exactly three distinct eligible abilities");

  const nonZero = Object.entries(bonuses).filter(([, value]) => (value ?? 0) !== 0) as Array<[AbilityId, number]>;
  for (const [ability, value] of nonZero) {
    if (!eligible.has(ability)) errors.push(`${ability} is not allowed by the background`);
    if (!Number.isInteger(value) || value < 1 || value > 2) errors.push(`${ability} bonus must be 1 or 2`);
  }
  const distribution = nonZero.map(([, value]) => value).sort((a, b) => b - a);
  const validDistribution =
    (distribution.length === 2 && distribution[0] === 2 && distribution[1] === 1) ||
    (distribution.length === 3 && distribution.every((value) => value === 1));
  if (!validDistribution) errors.push("Background bonuses must be +2/+1 or +1/+1/+1");
  return errors;
}

export function applyAbilityBonuses(
  baseScores: AbilityScores,
  bonuses: Readonly<Partial<Record<AbilityId, number>>>,
  maximum = 20
): AbilityScores {
  const result = { ...baseScores };
  for (const ability of ABILITY_IDS) {
    result[ability] = Math.min(maximum, baseScores[ability] + (bonuses[ability] ?? 0));
  }
  return result;
}

