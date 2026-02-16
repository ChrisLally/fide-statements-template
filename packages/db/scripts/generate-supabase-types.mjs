#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "qssddvtvjopazmhocivh";
const SCHEMA = "public";

const ALLOWED_TABLES = new Set([
  "fcp_raw_identifiers",
  "fcp_statements",
  "fcp_statement_batches",
  "fcp_statement_batch_items",
]);
const ALLOWED_VIEWS = new Set(["fcp_statements_identifiers_resolved"]);
const ALLOWED_FUNCTIONS = new Set();
const REQUIRED_ENUMS = new Set(["fcp_entity_type", "fcp_statement_predicate_type"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.resolve(__dirname, "..");
const outputPath = path.resolve(packageDir, "src/types/fcp-supabase.ts");
const dbEnvPath = path.resolve(packageDir, ".env");
const packagesEnvPath = path.resolve(packageDir, "../.env");
const rootEnvPath = path.resolve(packageDir, "../../.env");
const envPath = fs.existsSync(dbEnvPath)
  ? dbEnvPath
  : fs.existsSync(packagesEnvPath)
    ? packagesEnvPath
    : rootEnvPath;
const tempFullTypesPath = path.join(
  os.tmpdir(),
  `supabase-full-types-${Date.now()}.ts`,
);

function parseArgs(argv) {
  const args = { fromFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from-file") {
      args.fromFile = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return args;
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unclosed block starting at index ${openIndex}`);
}

function findNamedBlock(source, blockName, fromIndex = 0, toIndex = source.length) {
  const label = `${blockName}:`;
  const labelIndex = source.indexOf(label, fromIndex);
  if (labelIndex === -1 || labelIndex > toIndex) {
    throw new Error(`Could not find block "${blockName}"`);
  }
  const openIndex = source.indexOf("{", labelIndex);
  if (openIndex === -1 || openIndex > toIndex) {
    throw new Error(`Could not find opening brace for "${blockName}"`);
  }
  const closeIndex = findMatchingBrace(source, openIndex);
  return { labelIndex, openIndex, closeIndex };
}

function getEntries(inner) {
  const lines = inner.split("\n");
  const entries = [];
  let current = null;

  for (const line of lines) {
    const entryMatch = line.match(/^ {6}([A-Za-z0-9_]+):/);
    if (entryMatch) {
      if (current) entries.push(current);
      current = { key: entryMatch[1], lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) entries.push(current);
  return entries;
}

function buildInner(entries, keepSet, { emptyAsNever = true, requireAll = true } = {}) {
  const missing = [...keepSet].filter((name) => !entries.some((entry) => entry.key === name));
  if (requireAll && missing.length > 0) {
    throw new Error(`Missing expected entries: ${missing.join(", ")}`);
  }

  const kept = entries
    .filter((entry) => keepSet.has(entry.key))
    .map((entry) => entry.lines.join("\n").trimEnd());

  if (kept.length === 0) {
    if (emptyAsNever) {
      return "\n      [_ in never]: never\n    ";
    }
    return "\n    ";
  }

  return `\n${kept.join("\n")}\n    `;
}

function replaceBlockInner(source, block, newInner) {
  return `${source.slice(0, block.openIndex + 1)}${newInner}${source.slice(block.closeIndex)}`;
}

function getPublicSection(source, anchorText, sectionName) {
  const anchor = source.indexOf(anchorText);
  if (anchor === -1) throw new Error(`Could not find anchor "${anchorText}"`);
  const publicBlock = findNamedBlock(source, "public", anchor);
  return findNamedBlock(source, sectionName, publicBlock.openIndex, publicBlock.closeIndex);
}

function collectEnumReferences(...chunks) {
  const refs = new Set();
  const enumRefRegex = /Database\["public"\]\["Enums"\]\["([^"]+)"\]/g;

  for (const chunk of chunks) {
    let match;
    while ((match = enumRefRegex.exec(chunk))) {
      refs.add(match[1]);
    }
  }

  return refs;
}

function filterGeneratedTypes(fullTypesSource) {
  let source = fullTypesSource;

  const tablesBlock = getPublicSection(source, "export type Database = {", "Tables");
  const viewsBlock = getPublicSection(source, "export type Database = {", "Views");
  const functionsBlock = getPublicSection(source, "export type Database = {", "Functions");
  const enumsBlock = getPublicSection(source, "export type Database = {", "Enums");

  const tablesInner = source.slice(tablesBlock.openIndex + 1, tablesBlock.closeIndex);
  const viewsInner = source.slice(viewsBlock.openIndex + 1, viewsBlock.closeIndex);
  const functionsInner = source.slice(functionsBlock.openIndex + 1, functionsBlock.closeIndex);
  const enumsInner = source.slice(enumsBlock.openIndex + 1, enumsBlock.closeIndex);

  const tableEntries = getEntries(tablesInner);
  const viewEntries = getEntries(viewsInner);
  const functionEntries = getEntries(functionsInner);
  const enumEntries = getEntries(enumsInner);

  const filteredTablesInner = buildInner(tableEntries, ALLOWED_TABLES);
  const filteredViewsInner = buildInner(viewEntries, ALLOWED_VIEWS, { requireAll: false });
  const filteredFunctionsInner = buildInner(functionEntries, ALLOWED_FUNCTIONS);

  const usedEnums = collectEnumReferences(filteredTablesInner, filteredViewsInner, filteredFunctionsInner);
  for (const enumName of REQUIRED_ENUMS) usedEnums.add(enumName);

  const filteredEnumsInner = buildInner(enumEntries, usedEnums);

  source = replaceBlockInner(
    source,
    getPublicSection(source, "export type Database = {", "Tables"),
    filteredTablesInner,
  );
  source = replaceBlockInner(
    source,
    getPublicSection(source, "export type Database = {", "Views"),
    filteredViewsInner,
  );
  source = replaceBlockInner(
    source,
    getPublicSection(source, "export type Database = {", "Functions"),
    filteredFunctionsInner,
  );
  source = replaceBlockInner(
    source,
    getPublicSection(source, "export type Database = {", "Enums"),
    filteredEnumsInner,
  );

  const constantsEnums = getPublicSection(source, "export const Constants = {", "Enums");
  const constantsEnumsInner = source.slice(constantsEnums.openIndex + 1, constantsEnums.closeIndex);
  const constantEnumEntries = getEntries(constantsEnumsInner);
  const filteredConstantEnumsInner = buildInner(constantEnumEntries, usedEnums, {
    emptyAsNever: false,
  });
  source = replaceBlockInner(source, constantsEnums, filteredConstantEnumsInner);

  return source;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const fullTypes = args.fromFile
    ? fs.readFileSync(path.resolve(packageDir, args.fromFile), "utf8")
    : execFileSync(
          "pnpm",
        [
          "exec",
          "dotenv",
          "-e",
          envPath,
          "--",
          "npx",
          "supabase",
          "gen",
          "types",
          "typescript",
          "--project-id",
          PROJECT_ID,
          "--schema",
          SCHEMA,
        ],
        {
          cwd: packageDir,
          encoding: "utf8",
          maxBuffer: 1024 * 1024 * 20,
        },
      );

  fs.writeFileSync(tempFullTypesPath, fullTypes, "utf8");
  const narrowed = filterGeneratedTypes(fullTypes);
  fs.writeFileSync(outputPath, narrowed, "utf8");
  fs.unlinkSync(tempFullTypesPath);

  console.log(`Wrote filtered types to ${outputPath}`);
}

try {
  main();
} catch (error) {
  if (fs.existsSync(tempFullTypesPath)) {
    fs.unlinkSync(tempFullTypesPath);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
