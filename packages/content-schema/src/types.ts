export const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];
export type ContentId = string;
export type LocaleCode = string;
export type SemVer = string;

export type ContentStatus = "draft" | "review" | "published" | "deprecated";
export type PackKind = "official" | "homebrew" | "internal";
export type FeatureMode = "always_on" | "manual_unlimited" | "limited_use";
export type AutomationLevel = "full" | "partial" | "manual";

export interface TranslationEntry {
  name: string;
  shortName?: string;
  description?: string;
  rulesText?: string;
  summary?: string;
  aliases?: string[];
}

export interface ContentPackManifest {
  schemaVersion: SemVer;
  packId: ContentId;
  namespace: ContentId;
  version: SemVer;
  rulesetId: ContentId;
  kind: PackKind;
  author?: string;
  publisher?: string;
  defaultLocale: LocaleCode;
  locales: LocaleCode[];
  dependencies?: Array<{
    packId: ContentId;
    versionRange: string;
    optional?: boolean;
  }>;
  license: {
    id: ContentId;
    name: string;
    url?: string;
    attribution: string;
  };
  portability: {
    embedTechnicalData: boolean;
    embedLocalizedText: boolean;
    allowDerivativePacks: boolean;
    requiresEntitlement: boolean;
  };
  createdAt?: string;
  publishedAt?: string;
}

export interface CommonEntityFields {
  id: ContentId;
  entityType: string;
  rulesetId: ContentId;
  sourceId: ContentId;
  sourceVersion?: string;
  licenseId: ContentId;
  status: ContentStatus;
  tags?: string[];
  deprecatedBy?: ContentId;
}

export type EffectOperation =
  | "add"
  | "subtract"
  | "set"
  | "set_minimum"
  | "set_maximum"
  | "multiply"
  | "replace_formula"
  | "grant"
  | "grant_proficiency"
  | "upgrade_proficiency"
  | "grant_advantage"
  | "grant_disadvantage"
  | "create_resource"
  | "restore_resource";

export type EffectValue =
  | number
  | boolean
  | string
  | { type: "formula"; expression: string }
  | { type: "dice"; dice: string }
  | { type: "reference"; reference: { id: ContentId; packId?: ContentId; packVersion?: SemVer } };

export interface AtomicEffect {
  id: ContentId;
  target: string;
  operation: EffectOperation;
  value: EffectValue;
  activation: "always_on" | "manual_unlimited" | "limited_use" | "equipped" | "attuned" | "on_event";
  actionCost?: "none" | "action" | "bonus_action" | "reaction" | "free_action" | "special";
  trigger?: string;
  conditions?: string[];
  stacking: "sum" | "maximum" | "minimum" | "replace" | "non_stacking" | "unique_by_source";
  stackingGroup?: string;
  priority: number;
  resourceId?: ContentId;
  automationLevel?: AutomationLevel;
  notes?: string;
}

export interface ReferenceEntity extends CommonEntityFields {
  entityType: "reference";
  category: string;
  value: Record<string, unknown>;
}

export interface FeatureEntity extends CommonEntityFields {
  entityType: "feature";
  mode: FeatureMode;
  activation?: "none" | "action" | "bonus_action" | "reaction" | "free_action" | "special";
  resource?: {
    id: ContentId;
    maximumFormula: string;
    recovery: "short_rest" | "long_rest" | "both" | "dawn" | "manual" | "never";
    recoveryFormula?: string;
  };
  prerequisites?: string[];
  effects: AtomicEffect[];
  automationLevel: AutomationLevel;
}

export interface ClassLevelDefinition {
  level: number;
  featureIds: ContentId[];
}

export interface ClassEntity extends CommonEntityFields {
  entityType: "class";
  hitDie: "d6" | "d8" | "d10" | "d12";
  primaryAbilities: AbilityId[];
  multiclassPrerequisite?: string;
  startingHpFormula?: string;
  levelUpHpFormula?: string;
  startingProficiencies: ContentId[];
  multiclassProficiencies: ContentId[];
  spellcastingAbility?: AbilityId;
  casterProgression?: "none" | "full" | "half_down" | "half_up" | "third" | "pact" | "custom";
  casterLevelFormula?: string;
  levels: ClassLevelDefinition[];
}

export interface SubclassEntity extends CommonEntityFields {
  entityType: "subclass";
  classId: ContentId;
  levels: Array<{ classLevel: number; featureIds: ContentId[] }>;
}

export interface SpeciesEntity extends CommonEntityFields {
  entityType: "species";
  sizeOptions: ContentId[];
  baseSpeeds: Record<string, number>;
  featureIds: ContentId[];
}

export interface BackgroundEntity extends CommonEntityFields {
  entityType: "background";
  abilityOptions: [AbilityId, AbilityId, AbilityId];
  featId: ContentId;
  proficiencyGrants: ContentId[];
  equipmentOptions: Array<{
    id: ContentId;
    items: Array<{ itemId: ContentId; quantity: number }>;
    currencyCp: number;
  }>;
}

export interface FeatEntity extends CommonEntityFields {
  entityType: "feat";
  category: "origin" | "general" | "fighting_style" | "epic_boon" | "custom";
  repeatable: boolean;
  prerequisites?: string[];
  featureIds: ContentId[];
}

export interface SpellEntity extends CommonEntityFields {
  entityType: "spell";
  level: number;
  schoolId: ContentId;
  effects: AtomicEffect[];
  automationLevel: AutomationLevel;
  [technicalField: string]: unknown;
}

export interface ItemEntity extends CommonEntityFields {
  entityType: "item";
  itemType: string;
  weightLb: number;
  costCp: number;
  stackable: boolean;
  effects: AtomicEffect[];
  [technicalField: string]: unknown;
}

export type ContentEntity =
  | ReferenceEntity
  | FeatureEntity
  | ClassEntity
  | SubclassEntity
  | SpeciesEntity
  | BackgroundEntity
  | FeatEntity
  | SpellEntity
  | ItemEntity;

export interface ContentPack {
  manifest: ContentPackManifest;
  entities: ContentEntity[];
  localizations: Record<LocaleCode, Record<ContentId, TranslationEntry>>;
  assets: Array<{
    id: ContentId;
    path: string;
    mediaType: string;
    sha256: string;
  }>;
}

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterLevelEntry {
  characterLevel: number;
  classId: ContentId;
  subclassId?: ContentId;
  hpGain?: number;
  hitDieRoll?: number;
}

export interface CharacterDocument {
  schemaVersion: SemVer;
  characterId: string;
  ownerId: string;
  revision: number;
  status: "draft" | "active" | "archived";
  identity: {
    name: string;
    description: string;
    avatarAssetId?: string;
  };
  contentManifest: Array<{ packId: ContentId; version: SemVer; checksum?: string }>;
  build: {
    speciesId?: ContentId;
    backgroundId?: ContentId;
    abilityGeneration: unknown;
    backgroundAbilityBonuses?: Partial<Record<AbilityId, number>>;
    levelHistory: CharacterLevelEntry[];
    choices: Array<{ choiceId: ContentId; sourceId: ContentId; values: unknown[] }>;
  };
  runtimeState: Record<string, unknown>;
  derivedSnapshot?: Record<string, unknown>;
}

