/**
 * FCP indexer template
 *
 * Source modes:
 * - rekor (default): poll Rekor v2 tiled read APIs and advance a cursor
 * - filesystem: ingest statement-attestations + statement batches from local paths
 *
 * Rekor mode is intentionally independent of any attestor template path.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, isAbsolute, dirname } from "node:path";
import { Buffer } from "node:buffer";
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

type SourceMode = "rekor" | "filesystem";

const SOURCE_MODE = (process.env.FCP_INDEXER_SOURCE_MODE ?? "rekor") as SourceMode;

const FILESYSTEM_STATEMENT_ATTESTATIONS_PATH =
  process.env.FCP_STATEMENT_ATTESTATIONS_PATH ?? process.env.FCP_ATTESTATIONS_PATH ?? "";
const FILESYSTEM_STATEMENTS_PATH = process.env.FCP_STATEMENTS_PATH ?? "";

const REKOR_BASE_URL = (process.env.REKOR_BASE_URL ?? "https://log2025-1.rekor.sigstore.dev").replace(/\/+$/, "");
const REKOR_CHECKPOINT_URL = `${REKOR_BASE_URL}/checkpoint`;
const REKOR_TILE_PREFIX = `${REKOR_BASE_URL}/tile`;
const REKOR_CURSOR_PATH =
  process.env.FCP_REKOR_CURSOR_PATH ??
  "packages/fcp/demos/fide-indexer-template/.state/rekor-cursor.json";
const REKOR_TIMEOUT_MS = Number(process.env.REKOR_TIMEOUT_MS ?? "20000");
// Bootstrap window for first run (no cursor). This targets "about 24h" of recent activity.
// Rekor does not expose a direct "entries since timestamp" API for monitor reads, so this is
// an index lookback heuristic.
const REKOR_BOOTSTRAP_LOOKBACK_ENTRIES = 10000;

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

interface RekorCursor {
  lastProcessedLogIndex: number;
  updatedAt: string;
}

interface RekorPolledEntry {
  logIndex: number;
  entry: unknown;
}

function parseSourceMode(value: string): SourceMode {
  return value === "filesystem" ? "filesystem" : "rekor";
}

/** Find monorepo root (contains pnpm-workspace.yaml) */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function toAbsolutePath(pathLike: string): string {
  if (isAbsolute(pathLike)) return pathLike;
  return join(findRepoRoot(), pathLike);
}

function isHex(value: string, minLen = 1): boolean {
  return value.length >= minLen && /^[a-fA-F0-9]+$/.test(value);
}

function isIsoUtc(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && value.includes("T");
}

function validateStatementSchema(stmt: IndexedStatement): string | null {
  if (!stmt.s?.startsWith("did:fide:0x")) return "statement.s must be did:fide:0x...";
  if (!stmt.p?.startsWith("did:fide:0x")) return "statement.p must be did:fide:0x...";
  if (!stmt.o?.startsWith("did:fide:0x")) return "statement.o must be did:fide:0x...";
  if (typeof stmt.sr !== "string") return "statement.sr must be string";
  if (typeof stmt.pr !== "string") return "statement.pr must be string";
  if (typeof stmt.or !== "string") return "statement.or must be string";
  return null;
}

function validateAttestationSchema(a: JSONLStatementAttestation): string | null {
  const allowedMethods = new Set(["ed25519", "eip712", "eip191", "bip322", "solana:signMessage", "cosmos:ADR-036"]);
  if (!allowedMethods.has(a.m)) return "attestation.m is unsupported";
  if (typeof a.u !== "string" || !a.u.includes(":")) return "attestation.u must be CAIP-10-like";
  if (!isHex(a.r, 64)) return "attestation.r must be hex merkle root";
  if (!isHex(a.s, 16)) return "attestation.s must be hex signature";
  if (!isIsoUtc(a.t)) return "attestation.t must be ISO timestamp";
  return null;
}

function encodeTileIndex(n: number): string {
  if (n < 0) throw new Error("Tile index cannot be negative");
  const s = String(n).padStart(3, "0");
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    groups.push(s.slice(start, i).padStart(3, "0"));
  }
  groups.reverse();
  return groups.map((g, i) => (i === groups.length - 1 ? g : `x${g}`)).join("/");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(REKOR_TIMEOUT_MS) });
}

function parseCheckpointTreeSize(checkpoint: string): number {
  const lines = checkpoint.split("\n");
  const sizeLine = lines[1]?.trim();
  const size = Number(sizeLine);
  if (!Number.isFinite(size) || size < 0) {
    throw new Error(`Invalid checkpoint tree size line: ${String(sizeLine)}`);
  }
  return size;
}

function parseEntryBundle(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const len = (buf[offset]! << 8) | buf[offset + 1]!;
    offset += 2;
    if (offset + len > buf.length) break;
    out.push(buf.slice(offset, offset + len));
    offset += len;
  }
  return out;
}

async function loadRekorCursor(cursorPath: string): Promise<RekorCursor> {
  try {
    const raw = await readFile(cursorPath, "utf8");
    const parsed = JSON.parse(raw) as RekorCursor;
    if (typeof parsed.lastProcessedLogIndex === "number") return parsed;
  } catch {
    // fall through
  }
  return { lastProcessedLogIndex: -1, updatedAt: new Date(0).toISOString() };
}

async function saveRekorCursor(cursorPath: string, lastProcessedLogIndex: number): Promise<void> {
  await mkdir(dirname(cursorPath), { recursive: true });
  const payload: RekorCursor = {
    lastProcessedLogIndex,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(cursorPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function pollRekorEntries(): Promise<RekorPolledEntry[]> {
  const checkpointRes = await fetchWithTimeout(REKOR_CHECKPOINT_URL);
  if (!checkpointRes.ok) {
    throw new Error(`Failed to fetch checkpoint (${checkpointRes.status})`);
  }
  const checkpointText = await checkpointRes.text();
  const treeSize = parseCheckpointTreeSize(checkpointText);

  const cursorPath = toAbsolutePath(REKOR_CURSOR_PATH);
  let cursor = await loadRekorCursor(cursorPath);
  if (cursor.lastProcessedLogIndex < 0) {
    const seededLast = Math.max(treeSize - REKOR_BOOTSTRAP_LOOKBACK_ENTRIES - 1, -1);
    cursor = { lastProcessedLogIndex: seededLast, updatedAt: new Date().toISOString() };
    await saveRekorCursor(cursorPath, seededLast);
    const seededStart = seededLast + 1;
    const seededEnd = Math.max(treeSize - 1, seededStart);
    console.log(
      `ℹ No cursor found. Bootstrapped to recent window: entries ${seededStart}..${seededEnd}`
    );
  }

  const startIndex = cursor.lastProcessedLogIndex + 1;
  const endIndex = treeSize - 1;
  if (endIndex < startIndex) {
    console.log("ℹ Rekor poll: no new entries.");
    return [];
  }

  const entries: RekorPolledEntry[] = [];
  const firstTile = Math.floor(startIndex / 256);
  const lastTile = Math.floor(endIndex / 256);

  for (let tile = firstTile; tile <= lastTile; tile++) {
    const tileStart = tile * 256;
    const remaining = treeSize - tileStart;
    const width = remaining >= 256 ? 256 : Math.max(remaining, 0);
    if (width <= 0) continue;

    const tilePath = encodeTileIndex(tile);
    const partialUrl = `${REKOR_TILE_PREFIX}/entries/${tilePath}.p/${width}`;
    const fullUrl = `${REKOR_TILE_PREFIX}/entries/${tilePath}`;

    let body: Uint8Array | null = null;
    let res = await fetchWithTimeout(width < 256 ? partialUrl : fullUrl);

    if (!res.ok && width < 256) {
      // Partial tiles may disappear once full tiles are available; fallback to full tile.
      res = await fetchWithTimeout(fullUrl);
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch entry bundle (${res.status}) for tile ${tile}`);
    }

    body = new Uint8Array(await res.arrayBuffer());
    const bundleEntries = parseEntryBundle(body);

    for (let i = 0; i < bundleEntries.length; i++) {
      const logIndex = tileStart + i;
      if (logIndex < startIndex || logIndex > endIndex) continue;

      const text = Buffer.from(bundleEntries[i]!).toString("utf8");
      try {
        const parsed = JSON.parse(text) as unknown;
        entries.push({ logIndex, entry: parsed });
      } catch {
        // Keep raw text fallback so monitors can still inspect opaque entries.
        entries.push({ logIndex, entry: { raw: text } });
      }
    }
  }

  const maxSeen = entries.length > 0 ? entries[entries.length - 1]!.logIndex : cursor.lastProcessedLogIndex;
  await saveRekorCursor(cursorPath, maxSeen);

  console.log(`✓ Rekor poll: ${entries.length} new entries (${startIndex}..${endIndex})`);
  console.log(`✓ Cursor updated: ${cursorPath}`);

  return entries;
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

async function ingestFilesystemAttestations(
  statementAttestationsPath: string,
  statementsPath: string
): Promise<HydratedAttestation[]> {
  const basePath = toAbsolutePath(statementAttestationsPath);
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

  filePaths.sort();
  const latestPath = filePaths[filePaths.length - 1]!;
  console.log(`📄 Only indexing latest attestation: ${latestPath}`);

  const attestations: JSONLStatementAttestation[] = [];
  let invalidAttestations = 0;
  const content = await readFile(latestPath, "utf-8");
  for (const line of content.trim().split("\n")) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as JSONLStatementAttestation;
      const schemaError = validateAttestationSchema(parsed);
      if (schemaError) {
        invalidAttestations++;
        continue;
      }
      attestations.push(parsed);
    } catch {
      // skip malformed lines
    }
  }
  if (invalidAttestations > 0) {
    console.log(`⚠ Skipped ${invalidAttestations} attestation(s) failing schema policy`);
  }

  const hydrated: HydratedAttestation[] = [];
  for (const a of attestations) {
    const statements = await loadStatementsByMerkleRoot(statementsPath, a.r);
    if (!statements || statements.length === 0) {
      console.warn(`⚠ Missing statements file for merkle root ${a.r}`);
      continue;
    }
    hydrated.push({ attestation: a, statements });
  }

  return hydrated;
}

async function loadStatementsByMerkleRoot(
  statementsPath: string,
  merkleRoot: string
): Promise<IndexedStatement[] | null> {
  const basePath = toAbsolutePath(statementsPath);
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

  filePaths.sort();
  const latestPath = filePaths[filePaths.length - 1]!;
  const content = await readFile(latestPath, "utf-8");

  const statements: IndexedStatement[] = [];
  let invalidStatements = 0;
  for (const line of content.trim().split("\n")) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as IndexedStatement;
      const schemaError = validateStatementSchema(parsed);
      if (schemaError) {
        invalidStatements++;
        continue;
      }
      statements.push(parsed);
    } catch {
      // skip malformed lines
    }
  }
  if (invalidStatements > 0) {
    console.log(`⚠ Skipped ${invalidStatements} statement(s) failing schema policy (${merkleRoot})`);
  }

  return statements;
}

async function verifyAndMaterializeFilesystem(hydrated: HydratedAttestation[]): Promise<void> {
  let verified = 0;
  let failed = 0;
  const verifiedAttestations: HydratedAttestation[] = [];

  for (const item of hydrated) {
    const jsonl = item.attestation;
    const statements = item.statements;

    try {
      const statementFideIds = await Promise.all(statements.map((stmt) => toStatementFideId(stmt)));

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

        const isValid = await verifyAttestation(statementFideIds[0]!, proof0, attestationData, {
          method: "ed25519",
          publicKeyOrAddress: publicKey,
        });
        if (!isValid) {
          console.warn("⚠ Signature verification failed");
          failed++;
          continue;
        }
      }

      verified++;
      verifiedAttestations.push(item);
    } catch (err) {
      console.warn("⚠ Error processing attestation:", err);
      failed++;
    }
  }

  console.log(`\nVerified: ${verified}, Failed: ${failed}`);

  const pgUrl = getPgConnectionUrl();
  if (pgUrl && verifiedAttestations.length > 0) {
    const pool = new Pool({ connectionString: pgUrl });
    try {
      let stmtCount = 0;

      for (const hydratedItem of verifiedAttestations) {
        for (const s of hydratedItem.statements) {
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
            ON CONFLICT (statement_fingerprint) DO NOTHING`,
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
    console.log("\n✅ Filesystem indexing complete.");
  }
}

function extractKind(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const maybeKind = (entry as Record<string, unknown>).kind;
  return typeof maybeKind === "string" ? maybeKind : null;
}

function extractApiVersion(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const maybe = (entry as Record<string, unknown>).apiVersion;
  return typeof maybe === "string" ? maybe : null;
}

function extractHashedRekordDigestB64(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const obj = entry as Record<string, unknown>;
  const spec = obj.spec as Record<string, unknown> | undefined;
  const hr = spec?.hashedRekordV002 as Record<string, unknown> | undefined;
  const data = hr?.data as Record<string, unknown> | undefined;
  const digest = data?.digest;
  return typeof digest === "string" ? digest : null;
}

async function main() {
  const mode = parseSourceMode(SOURCE_MODE);
  console.log(`📥 Indexing (${mode} mode)...\n`);

  if (mode === "rekor") {
    const entries = await pollRekorEntries();
    if (entries.length === 0) return;
    const candidateCount = entries.filter((e) => !!extractHashedRekordDigestB64(e.entry)).length;
    console.log(`✓ Candidate hashedrekord entries: ${candidateCount}`);
    console.log(
      "ℹ Independent mode: no candidate files are persisted. " +
        "Attach an artifact resolver later to fetch and validate FCP content."
    );
    return;
  }

  // filesystem mode
  if (!FILESYSTEM_STATEMENT_ATTESTATIONS_PATH || !FILESYSTEM_STATEMENTS_PATH) {
    throw new Error(
      "filesystem mode requires FCP_STATEMENT_ATTESTATIONS_PATH (or FCP_ATTESTATIONS_PATH) and FCP_STATEMENTS_PATH"
    );
  }

  const hydrated = await ingestFilesystemAttestations(
    FILESYSTEM_STATEMENT_ATTESTATIONS_PATH,
    FILESYSTEM_STATEMENTS_PATH
  );
  console.log(`Found ${hydrated.length} attestation(s)`);

  if (hydrated.length === 0) {
    console.log("ℹ No attestations to index. Run attestor first or check your configured paths.");
    return;
  }

  await verifyAndMaterializeFilesystem(hydrated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
