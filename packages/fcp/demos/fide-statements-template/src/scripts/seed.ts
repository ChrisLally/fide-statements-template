/**
 * Seed sample FCP statements only (no attestation).
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
  console.log("🌱 Seeding statements-only batch...\n");

  const baseStatements: StatementInput[] = [
    {
      subject: {
        rawIdentifier: "https://x.com/microsoft",
        entityType: "Organization",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/name",
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
        rawIdentifier: "https://x.com/jeffbezos1",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/worksFor",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://en.wikipedia.org/wiki/Project_Prometheus_(company)",
        entityType: "Organization",
        sourceType: "Product",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/jeffbezos1",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/worksFor",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "jeff-bezos-ceo-tenure-cadabra-inc-wa-renamed-amazon-merged-amazon-de-1994-2021",
        entityType: "Event",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: "https://en.wikipedia.org/wiki/Satya_Nadella",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://schema.org/worksFor",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://x.com/microsoft",
        entityType: "Organization",
        sourceType: "Product",
      },
    },
  ];

  const sameAsStatements: StatementInput[] = [
    {
      subject: {
        rawIdentifier: "https://en.wikipedia.org/wiki/Project_Prometheus_(company)",
        entityType: "Organization",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://www.w3.org/2002/07/owl#sameAs",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://www.crunchbase.com/organization/project-prometheus",
        entityType: "Organization",
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
        rawIdentifier: "https://www.instagram.com/jeffbezos",
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
        rawIdentifier: "https://www.w3.org/2002/07/owl#sameAs",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://www.crunchbase.com/person/jeff-bezos",
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
        rawIdentifier: "https://www.w3.org/2002/07/owl#sameAs",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://en.wikipedia.org/wiki/Jeff_Bezos",
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
        rawIdentifier: "https://en.wikipedia.org/wiki/Satya_Nadella",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: "https://www.w3.org/2002/07/owl#sameAs",
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://x.com/satyanadella",
        entityType: "Person",
        sourceType: "Product",
      },
    },
  ];

  const { statements, root } = await batchStatementsWithRoot([
    ...baseStatements,
    ...sameAsStatements,
  ]);

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
