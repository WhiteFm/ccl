import assert from "node:assert/strict";
import test from "node:test";
import { proficiencyContribution, resolveProficiencyClaims } from "../src/proficiencies.ts";

test("duplicate proficiency sources are retained and marked for the UI", () => {
  const [resolution] = resolveProficiencyClaims([
    { targetId: "dnd.skill.perception", rank: 1, sourceId: "dnd.species.elf" },
    { targetId: "dnd.skill.perception", rank: 1, sourceId: "dnd.background.sailor", replaceableChoiceId: "choice.background.skill" }
  ]);
  assert.equal(resolution.effectiveRank, 1);
  assert.deepEqual(resolution.duplicateSourceIds, ["dnd.background.sailor"]);
  assert.deepEqual(resolution.replaceableChoiceIds, ["choice.background.skill"]);
  assert.equal(resolution.claims.length, 2);
});

test("expertise wins over proficiency without losing provenance", () => {
  const [resolution] = resolveProficiencyClaims([
    { targetId: "dnd.skill.stealth", rank: 1, sourceId: "dnd.background.criminal" },
    { targetId: "dnd.skill.stealth", rank: 2, sourceId: "dnd.feature.expertise" }
  ]);
  assert.equal(resolution.effectiveRank, 2);
  assert.equal(proficiencyContribution(2, 3), 6);
  assert.equal(proficiencyContribution(0.5, 3), 1);
});
