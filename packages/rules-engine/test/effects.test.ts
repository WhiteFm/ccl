import assert from "node:assert/strict";
import test from "node:test";
import type { AtomicEffect } from "../../content-schema/src/types.ts";
import { applyNumericEffects } from "../src/effects.ts";

const context = {
  characterLevel: 1,
  classLevels: { "dnd.class.fighter": 1 },
  abilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 },
  proficiencyBonus: 2
} as const;

function effect(overrides: Partial<AtomicEffect> & Pick<AtomicEffect, "id" | "operation" | "value">): AtomicEffect {
  return {
    target: "combat.initiative",
    activation: "always_on",
    actionCost: "none",
    stacking: "sum",
    priority: 100,
    ...overrides
  };
}

test("always-on numeric effects use deterministic operation order and produce a trace", () => {
  const result = applyNumericEffects(2, [
    effect({ id: "effect.multiply", operation: "multiply", value: 2, priority: 50 }),
    effect({ id: "effect.add-pb", operation: "add", value: { type: "formula", expression: "proficiency_bonus()" } }),
    effect({ id: "effect.minimum", operation: "set_minimum", value: 10 })
  ], context);
  assert.equal(result.value, 10);
  assert.deepEqual(result.trace.map((entry) => entry.effectId), ["effect.add-pb", "effect.multiply", "effect.minimum"]);
});

test("manual effects are not silently included in permanent mathematics", () => {
  const result = applyNumericEffects(2, [
    effect({ id: "effect.passive", operation: "add", value: 100, activation: "manual_unlimited" }),
    effect({ id: "effect.permanent", operation: "add", value: 1 })
  ], context);
  assert.equal(result.value, 3);
});

test("a non-stacking group applies only its strongest member", () => {
  const result = applyNumericEffects(0, [
    effect({ id: "effect.small", operation: "add", value: 2, stacking: "non_stacking", stackingGroup: "initiative.proficiency" }),
    effect({ id: "effect.large", operation: "add", value: 3, stacking: "non_stacking", stackingGroup: "initiative.proficiency" })
  ], context);
  assert.equal(result.value, 3);
  assert.deepEqual(result.trace.map((entry) => entry.effectId), ["effect.large"]);
});
