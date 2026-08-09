import type { AtomicEffect } from "../../content-schema/src/types.ts";
import { evaluateNumericFormula, type FormulaContext } from "./formula.ts";

export interface NumericEffectTrace {
  effectId: string;
  operation: AtomicEffect["operation"];
  before: number;
  operand: number;
  after: number;
}

export interface NumericEffectResult {
  value: number;
  trace: NumericEffectTrace[];
}

const ORDER: Readonly<Record<string, number>> = {
  set: 10,
  replace_formula: 10,
  add: 20,
  subtract: 20,
  multiply: 30,
  set_minimum: 40,
  set_maximum: 40
};

function numericOperand(effect: AtomicEffect, context: FormulaContext): number {
  if (typeof effect.value === "number") return effect.value;
  if (typeof effect.value === "object" && effect.value !== null && effect.value.type === "formula") {
    return evaluateNumericFormula(effect.value.expression, context);
  }
  throw new TypeError(`Effect ${effect.id} does not contain a numeric value`);
}

function selectNonStackingEffects(effects: readonly AtomicEffect[], context: FormulaContext): AtomicEffect[] {
  const selected: AtomicEffect[] = [];
  const groups = new Map<string, AtomicEffect[]>();
  for (const effect of effects) {
    if (effect.stacking !== "non_stacking" || !effect.stackingGroup) {
      selected.push(effect);
      continue;
    }
    const list = groups.get(effect.stackingGroup) ?? [];
    list.push(effect);
    groups.set(effect.stackingGroup, list);
  }
  for (const group of groups.values()) {
    const best = [...group].sort((left, right) => {
      const valueDifference = Math.abs(numericOperand(right, context)) - Math.abs(numericOperand(left, context));
      return valueDifference || right.priority - left.priority || left.id.localeCompare(right.id);
    })[0];
    selected.push(best);
  }
  return selected;
}

export function applyNumericEffects(
  baseValue: number,
  effects: readonly AtomicEffect[],
  context: FormulaContext
): NumericEffectResult {
  if (!Number.isFinite(baseValue)) throw new RangeError("Base value must be finite");
  const applicable = selectNonStackingEffects(
    effects.filter((effect) => ORDER[effect.operation] !== undefined && effect.activation === "always_on"),
    context
  ).sort((left, right) =>
    (ORDER[left.operation] ?? 999) - (ORDER[right.operation] ?? 999) ||
    left.priority - right.priority ||
    left.id.localeCompare(right.id)
  );

  let value = baseValue;
  const trace: NumericEffectTrace[] = [];
  for (const effect of applicable) {
    const before = value;
    const operand = numericOperand(effect, context);
    switch (effect.operation) {
      case "set":
      case "replace_formula":
        value = operand;
        break;
      case "add":
        value += operand;
        break;
      case "subtract":
        value -= operand;
        break;
      case "multiply":
        value *= operand;
        break;
      case "set_minimum":
        value = Math.max(value, operand);
        break;
      case "set_maximum":
        value = Math.min(value, operand);
        break;
      default:
        continue;
    }
    if (!Number.isFinite(value)) throw new RangeError(`Effect ${effect.id} produced a non-finite value`);
    trace.push({ effectId: effect.id, operation: effect.operation, before, operand, after: value });
  }
  return { value, trace };
}

