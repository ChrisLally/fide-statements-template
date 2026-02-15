/**
 * Seed test statements for FCP
 *
 * Uses @fide.work/fcp: buildStatementBatch, createAttestation, formatAttestationForJSONL,
 * generateRegistryPath, generateJSONLFilename, Ed25519 signing.
 *
 * Output: .fide/attestations/YYYY/MM/DD/YYYY-MM-DD-HHmm-1.jsonl
 *
 * Usage: pnpm seed
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateFideId,
  SCHEMA_PREDICATES,
  OWL_PREDICATES,
  buildStatementBatch,
  createStatement,
  createAttestation,
  formatAttestationForJSONL,
  generateRegistryPath,
  generateJSONLFilename,
  generateEd25519KeyPair,
  exportEd25519Keys,
  importEd25519Keys,
  signEd25519,
  getStatementRawIdentifier,
  type FideId,
} from "@fide.work/fcp";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

const ATTESTOR_ROOT = dirname(
  dirname(dirname(fileURLToPath(import.meta.url)))
);

const ATTESTATIONS_PATH =
  process.env.FCP_ATTESTATIONS_PATH ?? join(ATTESTOR_ROOT, ".fide", "attestations");

/** Evaluation method GitHub URLs → method names (0xe5 Product-sourced) */
const EVALUATION_METHODS = new Map<string, string>([
  [
    "https://github.com/fide-work/evaluation-methods/statement-accuracy/v1",
    "Fide-StatementAccuracy-v1",
  ],
  [
    "https://github.com/fide-work/evaluation-methods/bridging-consensus/v1",
    "Fide-BridgingConsensus-v1",
  ],
  [
    "https://github.com/fide-work/evaluation-methods/owl-sameas-person/v1",
    "Fide-OwlSameAs-Person-v1",
  ],
  [
    "https://github.com/fide-work/evaluation-methods/owl-sameas-organization/v1",
    "Fide-OwlSameAs-Organization-v1",
  ],
]);

/** Get evaluation method Fide ID (0xe5 Product-sourced) from GitHub URL */
async function getEvaluationMethodFideId(githubUrl: string) {
  return calculateFideId("EvaluationMethod", "Product", githubUrl);
}

async function main() {
  console.log("🌱 Broadcasting seed statements...\n");

  // 1. Resolve or generate Ed25519 key
  const privateKeyHex = process.env.ED25519_PRIVATE_KEY_HEX;
  const publicKeyHex = process.env.ED25519_PUBLIC_KEY_HEX;

  let keyPair: Awaited<ReturnType<typeof generateEd25519KeyPair>>;
  if (privateKeyHex && publicKeyHex) {
    keyPair = await importEd25519Keys(publicKeyHex, privateKeyHex);
    console.log("✓ Using Ed25519 key from env");
  } else {
    keyPair = await generateEd25519KeyPair();
    const exported = await exportEd25519Keys(keyPair);
    console.log("⚠ Generated new key. Add to .env for reproducible signing:");
    console.log(`  ED25519_PRIVATE_KEY_HEX=${exported.privateKeyHex}`);
    console.log(`  ED25519_PUBLIC_KEY_HEX=${exported.publicKeyHex}`);
    console.log();
  }

  const exported = await exportEd25519Keys(keyPair);
  const caip10User = `ed25519::${exported.address}`;

  const OWL_SAMEAS_PERSON =
    "https://github.com/fide-work/evaluation-methods/owl-sameas-person/v1";

  // 2a. Content statements
  const contentStatements = await buildStatementBatch([
    {
      subject: {
        rawIdentifier: "https://x.com/alice",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.name,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "Alice",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/bob",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.name,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "Bob",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/bob",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.worksFor,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://www.acme.com",
        entityType: "Organization",
        sourceType: "Product",
      },
    },
    {
      subject: {
        rawIdentifier: "https://www.acme.com",
        entityType: "Organization",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.name,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "Acme Corp",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: "https://github.com/alice",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.name,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "Alice Github",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/elonmusk",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: SCHEMA_PREDICATES.name,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "Elon Musk",
        entityType: "CreativeWork",
        sourceType: "CreativeWork",
      },
    },
  ]);

  // 2b. owl:sameAs (alias → primary) — X/Twitter handle sameAs GitHub
  const sameAsStatements = await buildStatementBatch([
    {
      subject: {
        rawIdentifier: "https://x.com/alice",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: OWL_PREDICATES.sameAs,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://github.com/alice",
        entityType: "Person",
        sourceType: "Product",
      },
    },
    {
      subject: {
        rawIdentifier: "https://x.com/bob",
        entityType: "Person",
        sourceType: "Product",
      },
      predicate: {
        rawIdentifier: OWL_PREDICATES.sameAs,
        entityType: "CreativeWork",
        sourceType: "Product",
      },
      object: {
        rawIdentifier: "https://github.com/bob",
        entityType: "Person",
        sourceType: "Product",
      },
    },
  ]);

  // 2c. Evaluation statements (trust votes for owl:sameAs via entity-type-specific methods)
  const evaluationStatements = await Promise.all(
    sameAsStatements.map((s) =>
      createStatement({
        subject: {
          rawIdentifier: getStatementRawIdentifier(
            s.subjectFideId,
            s.predicateFideId,
            s.objectFideId
          ),
          entityType: "Statement",
          sourceType: "Statement",
        },
        predicate: {
          rawIdentifier: OWL_SAMEAS_PERSON,
          entityType: "EvaluationMethod",
          sourceType: "Product",
        },
        object: {
          rawIdentifier: "1",
          entityType: "CreativeWork",
          sourceType: "CreativeWork",
        },
      })
    )
  );

  const statements = [
    ...contentStatements,
    ...sameAsStatements,
    ...evaluationStatements,
  ];

  const statementFideIds = statements
    .map((s) => s.statementFideId)
    .filter((id): id is FideId => !!id);

  console.log(`✓ Created ${statements.length} statements`);

  // 3. Create attestation (SDK)
  const attestation = await createAttestation(statementFideIds, {
    method: "ed25519",
    caip10User,
    sign: (root) => signEd25519(root, keyPair.privateKey),
  });

  console.log(`✓ Attestation created (${attestation.attestationFideId.slice(0, 20)}...)`);

  // 4. Format for JSONL and write
  const signedAt = new Date().toISOString();
  const jsonlAttestation = formatAttestationForJSONL(attestation, statements, signedAt);

  const now = new Date();
  const registryPath = generateRegistryPath(now);
  const filename = generateJSONLFilename(now, 1);
  const outputDir = join(ATTESTATIONS_PATH, registryPath);
  const outputPath = join(outputDir, filename);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(jsonlAttestation) + "\n", "utf-8");

  console.log(`✓ Wrote ${outputPath}`);

  // Evaluation method Fide IDs (0xe5 Product-sourced)
  console.log("\n📋 Evaluation methods (0xe5):");
  for (const [url, name] of EVALUATION_METHODS) {
    const fid = await getEvaluationMethodFideId(url);
    console.log(`   ${name}: ${fid}`);
  }

  console.log("\n✅ Seed complete. Next: git add & push your .fide/ artifacts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
