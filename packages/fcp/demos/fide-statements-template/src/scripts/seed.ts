/**
 * Seed sample FCP statements only (no attestation).
 *
 * Output:
 * - .fide/statements/YYYY/MM/DD/{merkleRoot}.jsonl
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStatementBatch,
  buildMerkleTree,
  calculateStatementFideId,
  SCHEMA_PREDICATES,
  type FideId,
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
  console.log("🌱 Seeding statements-only batch...\n");

  const statements = await buildStatementBatch([
    {
      subject: {
        rawIdentifier: "https://x.com/microsoft",
        entityType: "Organization",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.name,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "Microsoft",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/satyanadella",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.worksFor,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://x.com/microsoft",
        entityType: "Organization",
        sourceType: "Product",
      },
    },
  ]);

  const statementFideIds = statements
    .map((s) => s.statementFideId)
    .filter((id): id is FideId => !!id);

  if (statementFideIds.length === 0) {
    throw new Error("No statement Fide IDs generated.");
  }

  const recomputed = await Promise.all(
    statements.map((s) => calculateStatementFideId(s.subjectFideId, s.predicateFideId, s.objectFideId))
  );
  const { root } = await buildMerkleTree(recomputed);

  const now = new Date();
  const datePartition = getUTCDatePartition(now);
  const outDir = join(STATEMENTS_PATH, datePartition);
  const outPath = join(outDir, `${root}.jsonl`);

  const lines = statements
    .map((s) =>
      JSON.stringify({
        s: s.subjectFideId,
        sr: s.subjectRawIdentifier,
        p: s.predicateFideId,
        pr: s.predicateRawIdentifier,
        o: s.objectFideId,
        or: s.objectRawIdentifier,
      })
    )
    .join("\n");

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, `${lines}\n`, "utf8");

  console.log(`✓ Created ${statements.length} statements`);
  console.log(`✓ Merkle root: ${root}`);
  console.log(`✓ Wrote: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
