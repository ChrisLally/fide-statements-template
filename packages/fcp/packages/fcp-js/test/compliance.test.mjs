import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { calculateFideId, calculateStatementFideId } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const rawFideIdVectors = await readFile(resolve(here, "./vectors/calculateFideId.v0.json"), "utf8");
const fideIdVectors = JSON.parse(rawFideIdVectors);
const rawStatementVectors = await readFile(resolve(here, "./vectors/calculateStatementFideId.v0.json"), "utf8");
const statementVectors = JSON.parse(rawStatementVectors);
const verbose = process.argv.includes("--verbose");

let failures = 0;
let checks = 0;

for (const testCase of fideIdVectors.cases) {
  checks += 1;
  const actual = await calculateFideId(
    testCase.entityType,
    testCase.sourceEntityType,
    testCase.rawIdentifier
  );
  if (actual !== testCase.expectedFideId) {
    failures += 1;
    console.error(
      `[FAIL] ${testCase.name}\n  expected: ${testCase.expectedFideId}\n  actual:   ${actual}`
    );
  } else if (verbose) {
    console.log(
      `[PASS] ${testCase.name}\n  input:    (${testCase.entityType}, ${testCase.sourceEntityType}, ${JSON.stringify(testCase.rawIdentifier)})\n  expected: ${testCase.expectedFideId}\n  actual:   ${actual}`
    );
  }
}

for (const testCase of statementVectors.cases) {
  checks += 1;
  const actual = await calculateStatementFideId(
    testCase.subjectFideId,
    testCase.predicateFideId,
    testCase.objectFideId
  );
  if (actual !== testCase.expectedFideId) {
    failures += 1;
    console.error(
      `[FAIL] ${testCase.name}\n  expected: ${testCase.expectedFideId}\n  actual:   ${actual}`
    );
  } else if (verbose) {
    console.log(
      `[PASS] ${testCase.name}\n  input:    (${JSON.stringify(testCase.subjectFideId)}, ${JSON.stringify(testCase.predicateFideId)}, ${JSON.stringify(testCase.objectFideId)})\n  expected: ${testCase.expectedFideId}\n  actual:   ${actual}`
    );
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`[PASS] ${checks} golden vectors`);
