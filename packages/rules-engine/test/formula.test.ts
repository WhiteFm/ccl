import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFormula, evaluateNumericFormula, evaluateRequirement, FormulaError } from "../src/formula.ts";

const context = {
  characterLevel: 5,
  classLevels: { "dnd.class.fighter": 3, "dnd.class.wizard": 2 },
  abilityScores: { str: 13, dex: 16, con: 14, int: 18, wis: 10, cha: 8 },
  proficiencyBonus: 3
} as const;

test("numeric formulas read only the declared character context", () => {
  assert.equal(evaluateNumericFormula("proficiency_bonus() + ability_modifier(\"dex\")", context), 6);
  assert.equal(evaluateNumericFormula("max(class_level(\"dnd.class.fighter\"), 2) * 2", context), 6);
});

test("requirements support comparisons, precedence and logical operators", () => {
  assert.equal(evaluateRequirement("ability_score(\"str\") >= 13 || ability_score(\"dex\") >= 13", context), true);
  assert.equal(evaluateRequirement("character_level() == 5 && class_level(\"dnd.class.wizard\") == 2", context), true);
  assert.equal(evaluateFormula("1 + 2 * 3 == 7", context), true);
});

test("unsafe or invalid formulas fail explicitly", () => {
  assert.throws(() => evaluateFormula("globalThis.process.exit()", context), FormulaError);
  assert.throws(() => evaluateFormula("1 / 0", context), /Division by zero/);
  assert.throws(() => evaluateNumericFormula("character_level() > 1", context), /Expected a numeric formula result/);
});
