export interface CalculationNodeDefinition {
  id: string;
  dependsOn: readonly string[];
  description: string;
}

export const CALCULATION_NODES: readonly CalculationNodeDefinition[] = Object.freeze([
  { id: "character.totalLevel", dependsOn: ["character.levelHistory"], description: "Общий уровень персонажа" },
  { id: "character.classLevels", dependsOn: ["character.levelHistory"], description: "Уровни каждого класса" },
  { id: "character.proficiencyBonus", dependsOn: ["character.totalLevel", "rules.levelProgression"], description: "Бонус мастерства" },
  { id: "abilities.base", dependsOn: ["character.abilityGeneration"], description: "Базовые характеристики" },
  { id: "abilities.final", dependsOn: ["abilities.base", "character.background", "effects.abilities"], description: "Итоговые характеристики" },
  { id: "abilities.modifiers", dependsOn: ["abilities.final"], description: "Модификаторы характеристик" },
  { id: "proficiencies.resolved", dependsOn: ["character.choices", "content.grants"], description: "Владения и повторные источники" },
  { id: "saves", dependsOn: ["abilities.modifiers", "character.proficiencyBonus", "proficiencies.resolved", "effects.saves"], description: "Спасброски" },
  { id: "skills", dependsOn: ["abilities.modifiers", "character.proficiencyBonus", "proficiencies.resolved", "effects.skills"], description: "Навыки" },
  { id: "health.maximum", dependsOn: ["character.levelHistory", "abilities.modifiers", "content.classes", "effects.health"], description: "Максимум HP" },
  { id: "health.hitDice", dependsOn: ["character.classLevels", "content.classes"], description: "Пулы костей хитов" },
  { id: "combat.armorClass", dependsOn: ["abilities.modifiers", "inventory.equipped", "content.features", "effects.armorClass"], description: "Класс защиты" },
  { id: "combat.initiative", dependsOn: ["abilities.modifiers", "character.proficiencyBonus", "effects.initiative"], description: "Инициатива" },
  { id: "movement", dependsOn: ["character.species", "inventory.equipped", "effects.movement", "runtime.conditions"], description: "Скорости" },
  { id: "senses", dependsOn: ["character.species", "character.classLevels", "effects.senses"], description: "Чувства" },
  { id: "carrying", dependsOn: ["abilities.final", "character.size", "effects.carrying"], description: "Грузоподъёмность и толчок" },
  { id: "spellcasting.casterLevel", dependsOn: ["character.classLevels", "content.classes"], description: "Суммарный уровень заклинателя" },
  { id: "spellcasting.slots", dependsOn: ["spellcasting.casterLevel", "content.spellSlots", "effects.spellSlots"], description: "Ячейки заклинаний" },
  { id: "spellcasting.metrics", dependsOn: ["abilities.modifiers", "character.proficiencyBonus", "content.classes"], description: "Сл и атака заклинаниями" },
  { id: "resources.maximum", dependsOn: ["character.totalLevel", "character.classLevels", "abilities.modifiers", "character.proficiencyBonus", "content.features"], description: "Максимумы активных ресурсов" }
]);

export function assertAcyclicDependencies(nodes: readonly CalculationNodeDefinition[] = CALCULATION_NODES): void {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): void => {
    if (visited.has(nodeId) || !nodeIds.has(nodeId)) return;
    if (visiting.has(nodeId)) throw new Error(`Calculation dependency cycle detected at ${nodeId}`);
    visiting.add(nodeId);
    const node = nodes.find((candidate) => candidate.id === nodeId);
    for (const dependency of node?.dependsOn ?? []) visit(dependency);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const node of nodes) visit(node.id);
}

