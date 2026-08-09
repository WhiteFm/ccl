import assert from "node:assert/strict";
import test from "node:test";
import { assertAcyclicDependencies, CALCULATION_NODES } from "../src/dependencies.ts";

test("the initial calculation graph is acyclic", () => {
  assert.doesNotThrow(() => assertAcyclicDependencies(CALCULATION_NODES));
});

test("cycles are rejected before a ruleset is used", () => {
  assert.throws(() => assertAcyclicDependencies([
    { id: "a", dependsOn: ["b"], description: "A" },
    { id: "b", dependsOn: ["a"], description: "B" }
  ]), /cycle detected/);
});
