import assert from "node:assert/strict";
import test from "node:test";
import {
  abilityModifier,
  applyAbilityBonuses,
  assignAbilityRolls,
  generateAbilityRolls,
  resolveAbilityRoll,
  scoresFromAssignedRolls,
  validateBackgroundAbilityBonuses,
  validatePointBuy
} from "../src/abilities.ts";

test("Point Buy follows the 27-point table and enforces 8–15", () => {
  assert.deepEqual(validatePointBuy({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }), {
    valid: true,
    cost: 27,
    remaining: 0,
    errors: []
  });
  const invalid = validatePointBuy({ str: 16, dex: 15, con: 15, int: 8, wis: 8, cha: 8 });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /str must be an integer from 8 to 15/);
});

test("ability modifier uses the standard floor calculation", () => {
  assert.equal(abilityModifier(8), -1);
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(15), 2);
});

test("4d6 discards one lowest die and produces six assignable cards", () => {
  assert.deepEqual(resolveAbilityRoll("roll-1", [6, 1, 4, 1]), {
    id: "roll-1",
    dice: [6, 1, 4, 1],
    discardedIndex: 1,
    total: 11
  });
  const generated = generateAbilityRolls(() => 0.999);
  assert.equal(generated.length, 6);
  assert.ok(generated.every((roll) => roll.total === 18));
  const abilityIds = ["str", "dex", "con", "int", "wis", "cha"] as const;
  const assignments = Object.fromEntries(generated.map((roll, index) => [roll.id, abilityIds[index]]));
  const assigned = assignAbilityRolls(generated, assignments);
  assert.deepEqual(scoresFromAssignedRolls(assigned), { str: 18, dex: 18, con: 18, int: 18, wis: 18, cha: 18 });
});

test("background bonuses accept only +2/+1 or +1/+1/+1 and respect the cap", () => {
  assert.deepEqual(validateBackgroundAbilityBonuses(["str", "dex", "con"], { str: 2, con: 1 }), []);
  assert.deepEqual(validateBackgroundAbilityBonuses(["str", "dex", "con"], { str: 1, dex: 1, con: 1 }), []);
  assert.ok(validateBackgroundAbilityBonuses(["str", "dex", "con"], { str: 2, wis: 1 }).length > 0);
  assert.deepEqual(
    applyAbilityBonuses({ str: 19, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, { str: 2, con: 1 }),
    { str: 20, dex: 14, con: 14, int: 12, wis: 10, cha: 8 }
  );
});
