/**
 * Run a minimal sameAs trust evaluation and publish results as FCP statements.
 *
 * Output:
 * - .fide/statements/YYYY/MM/DD/{batchHash}.jsonl
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  batchStatementsWithRoot,
  type StatementInput,
} from "@fide.work/fcp";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

const TEMPLATE_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const FIDE_ROOT = join(TEMPLATE_ROOT, ".fide");
const STATEMENTS_PATH = process.env.FCP_STATEMENTS_PATH ?? join(FIDE_ROOT, "statements");

function getUTCDatePartition(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

async function main() {
  console.log("Evaluating sameAs trust method...");

  const now = new Date();
  const isoNow = now.toISOString();
  const runId = process.env.GITHUB_RUN_ID ?? "local";

  const methodIdentifier =
    process.env.FIDE_SAMEAS_METHOD_IDENTIFIER ??
    "https://fide.work/methods/identity/sameas-trust/v1";
  const evaluationEventIdentifier =
    process.env.FIDE_EVALUATION_EVENT_IDENTIFIER ??
    `https://fide.work/evaluations/sameas-trust/${isoNow.replace(/[:.]/g, "-")}-${runId}`;
  const inputSnapshotIdentifier =
    process.env.FIDE_EVALUATION_INPUT_IDENTIFIER ??
    "https://fide.work/inputs/identity/sameas/current";

  // Minimal template output:
  // - method metadata
  // - one evaluation event
  // - sample trusted sameAs verdicts that cite the event
  const statements: StatementInput[] = [
    {
      subject: {
        rawIdentifier: methodIdentifier,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/name",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "FIDE sameAs trust method v1",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: evaluationEventIdentifier,
        entityType: "Event",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/isBasedOn",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: methodIdentifier,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
    },
    {
      subject: {
        rawIdentifier: evaluationEventIdentifier,
        entityType: "Event",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/startDate",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: isoNow,
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: evaluationEventIdentifier,
        entityType: "Event",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/citation",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: inputSnapshotIdentifier,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/jeffbezos",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://www.w3.org/2002/07/owl#sameAs",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://www.wikidata.org/wiki/Q312556",
        entityType: "Person",
        sourceType: "Product",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/jeffbezos",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/citation",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: evaluationEventIdentifier,
        entityType: "Event",
        sourceType: "Product",
      },
    },
  ];

  const { statements: builtStatements, root } = await batchStatementsWithRoot(statements);
  const datePartition = getUTCDatePartition(now);
  const outDir = join(STATEMENTS_PATH, datePartition);
  const outPath = join(outDir, `${root}.jsonl`);

  const lines = builtStatements
    .map((s) =>
      JSON.stringify({
        s: s.subjectFideId,
        sr: s.subjectRawIdentifier,
        p: s.predicateFideId,
        pr: s.predicateRawIdentifier,
        o: s.objectFideId,
        or: s.objectRawIdentifier,
      }),
    )
    .join("\n");

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, `${lines}\n`, "utf8");

  console.log(`Created ${builtStatements.length} evaluation statements`);
  console.log(`Batch root: ${root}`);
  console.log(`Wrote: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

