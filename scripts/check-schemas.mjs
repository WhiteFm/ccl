import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_DIR = path.join(ROOT, "schemas");
const EXAMPLE_DIR = path.join(ROOT, "examples");
const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/;
const POINT_BUY_COSTS = new Map([[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]]);
const SCHEMA_IDS = {
  pack: "https://schemas.wsguild.net/ccl2/content-pack.schema.json",
  character: "https://schemas.wsguild.net/ccl2/character.schema.json",
  forgeProject: "https://schemas.wsguild.net/ccl2/forge-project.schema.json"
};

async function jsonFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await jsonFiles(fullPath));
    if (entry.isFile() && entry.name.endsWith(".json")) result.push(fullPath);
  }
  return result.sort();
}

async function parseJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, filePath)} is not valid JSON: ${error.message}`);
  }
}

function visit(value, callback, pointer = "#") {
  callback(value, pointer);
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, callback, `${pointer}/${index}`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      visit(item, callback, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
    }
  }
}

function resolvePointer(document, fragment, label) {
  if (fragment === "" || fragment === "#") return document;
  assert.ok(fragment.startsWith("#/"), `${label}: unsupported JSON Pointer ${fragment}`);
  return fragment.slice(2).split("/").reduce((current, part) => {
    const key = decodeURIComponent(part).replaceAll("~1", "/").replaceAll("~0", "~");
    assert.ok(current && Object.hasOwn(current, key), `${label}: unresolved JSON Pointer ${fragment}`);
    return current[key];
  }, document);
}

function splitReference(reference) {
  const hashIndex = reference.indexOf("#");
  if (hashIndex === -1) return [reference, "#"];
  return [reference.slice(0, hashIndex), reference.slice(hashIndex) || "#"];
}

function checkPack(pack, label) {
  assert.ok(pack?.manifest && Array.isArray(pack.entities), `${label}: expected a content pack`);
  const { manifest, entities, localizations } = pack;
  assert.match(manifest.packId, IDENTIFIER, `${label}: invalid packId`);
  assert.ok(manifest.locales.includes(manifest.defaultLocale), `${label}: default locale is not declared`);
  assert.deepEqual(Object.keys(localizations).sort(), [...manifest.locales].sort(), `${label}: localization files differ from manifest locales`);

  const entityIds = entities.map((entity) => entity.id);
  assert.equal(new Set(entityIds).size, entityIds.length, `${label}: duplicate entity id`);
  for (const entity of entities) {
    assert.match(entity.id, IDENTIFIER, `${label}: invalid entity id ${entity.id}`);
    assert.equal(entity.rulesetId, manifest.rulesetId, `${label}: ${entity.id} uses a different ruleset`);
  }
  for (const locale of manifest.locales) {
    const translations = localizations[locale];
    assert.ok(translations && typeof translations === "object", `${label}: missing locale ${locale}`);
    const translatedIds = Object.keys(translations);
    assert.deepEqual(translatedIds.sort(), [...entityIds].sort(), `${label}: ${locale} must translate every entity exactly once`);
    for (const [entityId, translation] of Object.entries(translations)) {
      assert.ok(typeof translation.name === "string" && translation.name.trim(), `${label}: ${locale}/${entityId} has no name`);
    }
  }
}

function checkCharacter(character, label) {
  assert.equal(character.build.levelHistory[0]?.characterLevel, 1, `${label}: character creation must start at level 1`);
  character.build.levelHistory.forEach((entry, index) => {
    assert.equal(entry.characterLevel, index + 1, `${label}: level history must be continuous`);
  });
  const generation = character.build.abilityGeneration;
  if (generation.method === "point_buy") {
    const scores = generation.scores;
    const abilityIds = ["str", "dex", "con", "int", "wis", "cha"];
    assert.deepEqual(Object.keys(scores).sort(), [...abilityIds].sort(), `${label}: Point Buy requires six abilities`);
    const cost = abilityIds.reduce((total, ability) => {
      assert.ok(POINT_BUY_COSTS.has(scores[ability]), `${label}: ${ability} must be between 8 and 15`);
      return total + POINT_BUY_COSTS.get(scores[ability]);
    }, 0);
    assert.ok(cost <= generation.budget, `${label}: Point Buy exceeds budget`);
    assert.equal(generation.budget, 27, `${label}: expected the 27-point budget`);
  }
}

const schemaFiles = await jsonFiles(SCHEMA_DIR);
const schemas = new Map();
const schemasByFile = new Map();
for (const filePath of schemaFiles) {
  const schema = await parseJson(filePath);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", `${path.basename(filePath)}: unexpected draft`);
  assert.ok(schema.$id, `${path.basename(filePath)}: missing $id`);
  assert.ok(!schemas.has(schema.$id), `${path.basename(filePath)}: duplicate $id ${schema.$id}`);
  schemas.set(schema.$id, schema);
  schemasByFile.set(filePath, schema);
}

for (const [filePath, schema] of schemasByFile) {
  visit(schema, (value, pointer) => {
    if (!value || typeof value !== "object" || typeof value.$ref !== "string") return;
    const [documentId, fragment] = splitReference(value.$ref);
    const resolvedDocumentId = documentId ? new URL(documentId, schema.$id).href : schema.$id;
    const target = schemas.get(resolvedDocumentId);
    assert.ok(target, `${path.basename(filePath)}${pointer}: unknown schema ${resolvedDocumentId}`);
    resolvePointer(target, fragment, `${path.basename(filePath)}${pointer}`);
  });
}

const exampleFiles = await jsonFiles(EXAMPLE_DIR);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const schema of schemas.values()) ajv.addSchema(schema);

function assertSchema(schemaId, document, label) {
  const validate = ajv.getSchema(schemaId);
  assert.ok(validate, `${label}: schema ${schemaId} was not compiled`);
  if (!validate(document)) {
    const details = validate.errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
    assert.fail(`${label}: JSON Schema validation failed: ${details}`);
  }
}

for (const filePath of exampleFiles) {
  const example = await parseJson(filePath);
  const label = path.relative(ROOT, filePath);
  if (example.manifest) {
    assertSchema(SCHEMA_IDS.pack, example, label);
    checkPack(example, label);
  }
  else if (example.draftPack) {
    assertSchema(SCHEMA_IDS.forgeProject, example, label);
    assert.match(example.projectId, /^[a-z0-9-]+$/, `${label}: invalid project id`);
    checkPack(example.draftPack, `${label}/draftPack`);
  } else if (example.characterId) {
    assertSchema(SCHEMA_IDS.character, example, label);
    checkCharacter(example, label);
  }
  else assert.fail(`${label}: unknown example document type`);
}

console.log(`Schema structure: ${schemaFiles.length} schemas parsed, all $ref targets resolved.`);
console.log(`Examples: ${exampleFiles.length} JSON documents passed Draft 2020-12 and canonical integrity checks.`);
