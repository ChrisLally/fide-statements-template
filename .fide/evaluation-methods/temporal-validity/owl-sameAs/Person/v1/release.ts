import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { assertFideId, calculateFideId, calculateStatementFideId } from "@chris-test/fcp";
import { META } from "./meta.js";
import type { FideIdStatement, EvaluateSameAsInput, EvaluateSameAsResult } from "./types.js";
import { evaluateSameAsPersonV1 } from "./evaluate.js";

const PREDICATE_OWL_SAME_AS = "https://www.w3.org/2002/07/owl#sameAs";
const PREDICATE_SCHEMA_VALID_FROM = "https://schema.org/validFrom";
const PREDICATE_SCHEMA_VALID_THROUGH = "https://schema.org/validThrough";
const PREDICATE_PROV_HAD_PRIMARY_SOURCE = "https://www.w3.org/ns/prov#hadPrimarySource";

type DispatchItem = {
  urlBase: string;
  urlPath: string;
  root: string;
};

type DispatchPayload = {
  methodId?: string;
  methodVersion?: string;
  targetSameAsStatementFideId?: string;
  input: DispatchItem;
};

type RawStatementLine = {
  s: string;
  p: string;
  o: string;
  sr?: string;
  pr?: string;
  or?: string;
};

async function buildKnownPredicateMap(): Promise<Map<string, string>> {
  const pairs = await Promise.all([
    calculateFideId("Concept", "NetworkResource", "https://www.w3.org/2002/07/owl#sameAs"),
    calculateFideId("Concept", "NetworkResource", PREDICATE_SCHEMA_VALID_FROM),
    calculateFideId("Concept", "NetworkResource", PREDICATE_SCHEMA_VALID_THROUGH),
    calculateFideId("Concept", "NetworkResource", PREDICATE_PROV_HAD_PRIMARY_SOURCE),
  ]);
  return new Map<string, string>([
    [pairs[0], "https://www.w3.org/2002/07/owl#sameAs"],
    [pairs[1], PREDICATE_SCHEMA_VALID_FROM],
    [pairs[2], PREDICATE_SCHEMA_VALID_THROUGH],
    [pairs[3], PREDICATE_PROV_HAD_PRIMARY_SOURCE],
  ]);
}

function parseDirectInput(): EvaluateSameAsInput {
  const raw = process.env.FIDE_EVALUATE_INPUT_JSON;

  if (!raw) {
    throw new Error("Missing required FIDE_EVALUATE_INPUT_JSON environment variable.");
  }

  try {
    return JSON.parse(raw) as EvaluateSameAsInput;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid FIDE_EVALUATE_INPUT_JSON: ${reason}`);
  }
}

function parseDispatchPayload(): DispatchPayload {
  const raw = process.env.FIDE_EVALUATION_DISPATCH_JSON;
  if (!raw) {
    throw new Error("Missing required FIDE_EVALUATION_DISPATCH_JSON environment variable.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid FIDE_EVALUATION_DISPATCH_JSON: ${reason}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid dispatch payload: expected JSON object.");
  }

  const payload = parsed as Partial<DispatchPayload>;
  const input = payload.input;
  if (!input || typeof input.urlBase !== "string" || typeof input.urlPath !== "string" || typeof input.root !== "string") {
    throw new Error("Invalid dispatch payload: input must include string urlBase, urlPath, and root.");
  }
  const expectedSuffix = `${input.root}.jsonl`;
  if (!input.urlPath.endsWith(expectedSuffix)) {
    throw new Error(`Invalid dispatch payload: input.urlPath must end with ${expectedSuffix}.`);
  }

  return payload as DispatchPayload;
}

function joinUrl(urlBase: string, urlPath: string): string {
  const base = urlBase.endsWith("/") ? urlBase.slice(0, -1) : urlBase;
  const path = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
  return `${base}/${path}`;
}

async function fetchInputStatements(input: DispatchItem): Promise<FideIdStatement[]> {
  const all: FideIdStatement[] = [];
  const knownPredicateByFideId = await buildKnownPredicateMap();

  const url = joinUrl(input.urlBase, input.urlPath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSONL in ${url}: ${reason}`);
    }

    const raw = parsed as Partial<RawStatementLine>;
    if (!raw || typeof raw.s !== "string" || typeof raw.p !== "string" || typeof raw.o !== "string") {
      throw new Error(`Invalid statement line in ${url}: expected keys s,p,o as strings (sr/pr/or optional).`);
    }

    assertFideId(raw.s);
    assertFideId(raw.p);
    assertFideId(raw.o);
    const statementFideId = await calculateStatementFideId(raw.s, raw.p, raw.o);
    const predicateRawIdentifier =
      (typeof raw.pr === "string" && raw.pr.length > 0)
        ? raw.pr
        : (knownPredicateByFideId.get(raw.p) ?? "");
    all.push({
      statementFideId,
      subjectFideId: raw.s,
      subjectRawIdentifier: typeof raw.sr === "string" ? raw.sr : "",
      predicateFideId: raw.p,
      predicateRawIdentifier,
      objectFideId: raw.o,
      objectRawIdentifier: typeof raw.or === "string" ? raw.or : "",
    });
  }

  return all;
}

function evaluateAllCandidates(statements: FideIdStatement[], targetSameAsStatementFideId?: string): EvaluateSameAsResult[] {
  if (targetSameAsStatementFideId) {
    return [evaluateSameAsPersonV1({ targetSameAsStatementFideId, statements })];
  }

  const sameAsCandidates = statements.filter(
    (statement) => statement.predicateRawIdentifier === PREDICATE_OWL_SAME_AS
  );

  return sameAsCandidates.map((candidate) =>
    evaluateSameAsPersonV1({
      targetSameAsStatementFideId: candidate.statementFideId,
      statements,
    })
  );
}

async function runCli(): Promise<void> {
  const dispatch = process.env.FIDE_EVALUATION_DISPATCH_JSON;

  if (dispatch) {
    const payload = parseDispatchPayload();
    const statements = await fetchInputStatements(payload.input);
    const results = evaluateAllCandidates(statements, payload.targetSameAsStatementFideId);

    const output = {
      methodId: payload.methodId ?? META.methodId,
      methodVersion: payload.methodVersion ?? META.methodVersion,
      input: payload.input,
      statementCount: statements.length,
      evaluationCount: results.length,
      results,
    };

    const outputPath = process.env.FIDE_EVALUATION_OUTPUT_PATH;
    if (outputPath) {
      await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
    }

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const input = parseDirectInput();
  const result = evaluateSameAsPersonV1(input);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
