/**
 * Index FCP attestations
 *
 * 1. Ingest from packages/fcp/demos/fide-attestor-template/.fide/statement-attestations/ (or FCP_ATTESTATIONS_PATH)
 * 2. Verify using @fide.work/fcp (buildMerkleTree, verifyAttestation)
 * 3. Materialize to Postgres (placeholder - needs port from legacy)
 *
 * Env: DATABASE_URL (full URL), or
 *      PG_HOST + PG_PORT + PG_USER + PG_PASSWORD + PG_DATABASE
 *
 * Usage: pnpm index
 */

import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import { getPgConnectionUrl } from "../lib/db.js";
import { loadDemoEnv } from "../lib/env.js";
import {
  calculateStatementFideId,
  buildMerkleTree,
  verifyAttestation,
  extractFideIdFingerprint,
  extractFideIdTypeAndSource,
  type AttestationData,
} from "@fide.work/fcp";

loadDemoEnv();

const ATTESTATIONS_PATH =
  process.env.FCP_ATTESTATIONS_PATH ??
  "packages/fcp/demos/fide-attestor-template/.fide/statement-attestations";
const STATEMENTS_PATH =
  process.env.FCP_STATEMENTS_PATH ??
  "packages/fcp/demos/fide-attestor-template/.fide/statements";

interface IndexedStatement {
  s: string;
  sr: string;
  p: string;
  pr: string;
  o: string;
  or: string;
}

interface JSONLStatementAttestation {
  m: string;
  u: string;
  r: string;
  s: string;
  t: string;
}

interface HydratedAttestation {
  attestation: JSONLStatementAttestation;
  statements: IndexedStatement[];
}

/** Find monorepo root (contains pnpm-workspace.yaml) */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Import Ed25519 public key from hex (SPKI format from exportEd25519Keys, or raw 32-byte) */
async function importEd25519PublicKey(hex: string): Promise<CryptoKey> {
  const buffer = Buffer.from(hex, "hex");
  const crypto = globalThis.crypto ?? (await import("node:crypto")).webcrypto;
  // SPKI is ~90 bytes, raw is 32. Use spki for SDK-exported keys.
  const format = buffer.length === 32 ? "raw" : "spki";
  return await crypto.subtle.importKey(
    format,
    buffer,
    { name: "Ed25519" },
    true,
    ["verify"]
  );
}

/** Compute statement Fide ID from JSONL statement (expects full did:fide:0x... in s, p, o) */
async function toStatementFideId(stmt: {
  s: string;
  p: string;
  o: string;
}): Promise<string> {
  return await calculateStatementFideId(stmt.s, stmt.p, stmt.o);
}

async function ingestAttestations(): Promise<JSONLStatementAttestation[]> {
  const repoRoot = findRepoRoot();
  const basePath = join(repoRoot, ATTESTATIONS_PATH);
  const filePaths: string[] = [];

  async function walk(dir: string) {
    let entries: Dirent[];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw err;
    }

    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.name.endsWith(".jsonl")) {
        filePaths.push(full);
      }
    }
  }

  await walk(basePath);

  if (filePaths.length === 0) return [];

  // Sort paths to find the latest (filenames are YYYY-MM-DD-HHmm-N.jsonl)
  filePaths.sort();
  const latestPath = filePaths[filePaths.length - 1]!;
  console.log(`📄 Only indexing latest attestation: ${latestPath}`);

  const attestations: JSONLStatementAttestation[] = [];
  const content = await readFile(latestPath, "utf-8");
  for (const line of content.trim().split("\n")) {
    if (!line) continue;
    try {
      attestations.push(JSON.parse(line) as JSONLStatementAttestation);
    } catch {
      // skip malformed lines
    }
  }

  return attestations;
}

async function loadStatementsByMerkleRoot(
  merkleRoot: string
): Promise<IndexedStatement[] | null> {
  const repoRoot = findRepoRoot();
  const basePath = join(repoRoot, STATEMENTS_PATH);
  const filePaths: string[] = [];

  async function walk(dir: string) {
    let entries: Dirent[];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw err;
    }

    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && ent.name === `${merkleRoot}.jsonl`) {
        filePaths.push(full);
      }
    }
  }

  await walk(basePath);
  if (filePaths.length === 0) return null;

  // If multiple matches exist, use the latest lexicographic path.
  filePaths.sort();
  const latestPath = filePaths[filePaths.length - 1]!;
  const content = await readFile(latestPath, "utf-8");

  const statements: IndexedStatement[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line) continue;
    try {
      statements.push(JSON.parse(line) as IndexedStatement);
    } catch {
      // skip malformed lines
    }
  }

  return statements;
}

async function main() {
  console.log("📥 Indexing attestations...\n");

  const attestations = await ingestAttestations();
  console.log(`Found ${attestations.length} attestation(s)`);

  if (attestations.length === 0) {
    console.log(
      "ℹ No attestations to index. Run pnpm --filter fide-attestor-template seed first."
    );
    return;
  }

  let verified = 0;
  let failed = 0;
  const verifiedAttestations: HydratedAttestation[] = [];

  for (const jsonl of attestations) {
    try {
      const statements = await loadStatementsByMerkleRoot(jsonl.r);
      if (!statements || statements.length === 0) {
        console.warn(`⚠ Missing statements file for merkle root ${jsonl.r}`);
        failed++;
        continue;
      }

      // Rebuild statement Fide IDs from JSONL
      const statementFideIds = await Promise.all(
        statements.map((stmt) => toStatementFideId(stmt))
      );

      // Rebuild Merkle tree to get proofs
      const { root, proofs } = await buildMerkleTree(statementFideIds);
      if (root !== jsonl.r) {
        console.warn("⚠ Merkle root mismatch");
        failed++;
        continue;
      }

      const attestationData: AttestationData = {
        m: jsonl.m as AttestationData["m"],
        u: jsonl.u,
        r: jsonl.r,
        s: jsonl.s,
      };

      // Verify - public key is in attestation's u field (CAIP-10: ed25519::{rawPublicKeyHex})
      if (attestationData.m === "ed25519") {
        const addressMatch = attestationData.u.match(/^ed25519::([a-fA-F0-9]{64})$/);
        if (!addressMatch) {
          console.warn("⚠ Invalid Ed25519 CAIP-10 in attestation");
          failed++;
          continue;
        }
        const rawPublicKeyHex = addressMatch[1];
        const publicKey = await importEd25519PublicKey(rawPublicKeyHex);

        const proof0 = proofs.get(statementFideIds[0]!);
        if (!proof0) {
          console.warn("⚠ No proof for first statement");
          failed++;
          continue;
        }

        const isValid = await verifyAttestation(
          statementFideIds[0]!,
          proof0,
          attestationData,
          { method: "ed25519", publicKeyOrAddress: publicKey }
        );
        if (!isValid) {
          console.warn("⚠ Signature verification failed");
          failed++;
          continue;
        }
      }

      verified++;
      verifiedAttestations.push({ attestation: jsonl, statements });
    } catch (err) {
      console.warn("⚠ Error processing attestation:", err);
      failed++;
    }
  }

  console.log(`\nVerified: ${verified}, Failed: ${failed}`);

  // Materialize to Postgres (requires DATABASE_URL or PG_* env)
  const pgUrl = getPgConnectionUrl();
  if (pgUrl && verifiedAttestations.length > 0) {
    const pool = new Pool({ connectionString: pgUrl });
    try {
      let stmtCount = 0;

      for (const hydrated of verifiedAttestations) {
        for (const s of hydrated.statements) {
          const subjFp = extractFideIdFingerprint(s.s);
          const subjType = extractFideIdTypeAndSource(s.s);
          const predFp = extractFideIdFingerprint(s.p);
          const predType = extractFideIdTypeAndSource(s.p);
          const objFp = extractFideIdFingerprint(s.o);
          const objType = extractFideIdTypeAndSource(s.o);

          await pool.query(
            `INSERT INTO fcp_raw_identifiers (identifier_fingerprint, raw_identifier)
             VALUES ($1, $2), ($3, $4), ($5, $6)
             ON CONFLICT (identifier_fingerprint) 
             DO UPDATE SET raw_identifier = EXCLUDED.raw_identifier`,
            [subjFp, s.sr, predFp, s.pr, objFp, s.or]
          );

          const statementFideId = await toStatementFideId(s);
          const stmtFp = extractFideIdFingerprint(statementFideId);

          await pool.query(
            `INSERT INTO fcp_statements (
              statement_fingerprint, subject_type, subject_source_type, subject_fingerprint,
              predicate_fingerprint, predicate_type, predicate_source_type,
              object_type, object_source_type, object_fingerprint
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (statement_fingerprint) DO NOTHING`, // Statements are immutable, no need to update
            [
              stmtFp,
              subjType.typeChar,
              subjType.sourceChar,
              subjFp,
              predFp,
              predType.typeChar,
              predType.sourceChar,
              objType.typeChar,
              objType.sourceChar,
              objFp,
            ]
          );
          stmtCount++;
        }
      }

      await pool.query("SELECT refresh_fcp_statements_identifiers_resolved()");
      console.log(`\n📦 Materialized: ${stmtCount} statements`);
    } finally {
      await pool.end();
    }
  } else if (verifiedAttestations.length > 0) {
    console.log("\nℹ Set DATABASE_URL (or PG_*) for materialization");
  }

  if (verified > 0) {
    console.log("\n✅ Indexing complete.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
