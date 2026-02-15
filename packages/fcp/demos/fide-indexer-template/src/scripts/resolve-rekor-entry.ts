import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { Buffer } from "node:buffer";
import { X509Certificate } from "node:crypto";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

const REKOR_BASE_URL = (process.env.REKOR_BASE_URL ?? "https://log2025-1.rekor.sigstore.dev").replace(/\/+$/, "");
const REKOR_CHECKPOINT_URL = `${REKOR_BASE_URL}/checkpoint`;
const REKOR_TILE_PREFIX = `${REKOR_BASE_URL}/tile`;
const REKOR_TIMEOUT_MS = Number(process.env.REKOR_TIMEOUT_MS ?? "20000");
const OUT_DIR =
  process.env.FCP_REKOR_RESOLVE_OUTPUT_DIR ??
  "packages/fcp/demos/fide-indexer-template/.state";

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

function encodeTileIndex(n: number): string {
  const s = String(n).padStart(3, "0");
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    groups.push(s.slice(start, i).padStart(3, "0"));
  }
  groups.reverse();
  return groups.map((g, i) => (i === groups.length - 1 ? g : `x${g}`)).join("/");
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

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(REKOR_TIMEOUT_MS) });
}

function parseCheckpointTreeSize(checkpoint: string): number {
  const lines = checkpoint.split("\n");
  const size = Number(lines[1]?.trim());
  if (!Number.isFinite(size) || size < 0) {
    throw new Error("Invalid checkpoint tree size");
  }
  return size;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractIdentityUrisFromCertRawB64(certRawB64: string): string[] {
  try {
    const certDer = Buffer.from(certRawB64, "base64");
    const cert = new X509Certificate(certDer);
    const san = cert.subjectAltName ?? "";
    return san
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("URI:"))
      .map((s) => s.slice(4));
  } catch {
    return [];
  }
}

function normalizeEntry(logIndex: number, entry: unknown): Record<string, unknown> {
  const obj = asObject(entry);
  const out: Record<string, unknown> = {
    logIndex,
    kind: null,
    apiVersion: null,
    dsse: null,
    raw: entry,
  };
  if (!obj) return out;

  const kind = typeof obj.kind === "string" ? obj.kind : null;
  const apiVersion = typeof obj.apiVersion === "string" ? obj.apiVersion : null;
  out.kind = kind;
  out.apiVersion = apiVersion;

  if (kind !== "dsse") return out;
  const spec = asObject(obj.spec);
  const dsse = asObject(spec?.dsseV002);
  if (!dsse) return out;

  const payloadHash = asObject(dsse.payloadHash);
  const signatures = Array.isArray(dsse.signatures) ? dsse.signatures : [];
  const normalizedSigs = signatures.map((sig, i) => {
    const s = asObject(sig);
    const content = typeof s?.content === "string" ? s.content : null;
    const verifier = asObject(s?.verifier);
    const keyDetails = typeof verifier?.keyDetails === "string" ? verifier.keyDetails : null;
    const publicKey = asObject(verifier?.publicKey);
    const publicKeyRawBytes = typeof publicKey?.rawBytes === "string" ? publicKey.rawBytes : null;
    const x509 = asObject(verifier?.x509Certificate);
    const certRawBytes = typeof x509?.rawBytes === "string" ? x509.rawBytes : null;
    return {
      index: i,
      content,
      keyDetails,
      publicKeyRawBytes,
      certRawBytes,
      certIdentityUris: certRawBytes ? extractIdentityUrisFromCertRawB64(certRawBytes) : [],
    };
  });

  out.dsse = {
    payloadHashAlgorithm:
      payloadHash && typeof payloadHash.algorithm === "string" ? payloadHash.algorithm : null,
    payloadHashDigest:
      payloadHash && typeof payloadHash.digest === "string" ? payloadHash.digest : null,
    signatures: normalizedSigs,
  };
  return out;
}

async function fetchEntryByLogIndex(logIndex: number): Promise<unknown> {
  const checkpointRes = await fetchWithTimeout(REKOR_CHECKPOINT_URL);
  if (!checkpointRes.ok) {
    throw new Error(`Failed to fetch checkpoint (${checkpointRes.status})`);
  }
  const treeSize = parseCheckpointTreeSize(await checkpointRes.text());
  if (logIndex < 0 || logIndex >= treeSize) {
    throw new Error(`Log index ${logIndex} out of range (treeSize=${treeSize})`);
  }

  const tile = Math.floor(logIndex / 256);
  const tileStart = tile * 256;
  const width = Math.min(256, treeSize - tileStart);
  const offset = logIndex - tileStart;
  const tilePath = encodeTileIndex(tile);
  const partialUrl = `${REKOR_TILE_PREFIX}/entries/${tilePath}.p/${width}`;
  const fullUrl = `${REKOR_TILE_PREFIX}/entries/${tilePath}`;

  let res = await fetchWithTimeout(width < 256 ? partialUrl : fullUrl);
  if (!res.ok && width < 256) {
    res = await fetchWithTimeout(fullUrl);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch tile ${tile} (${res.status})`);
  }

  const body = new Uint8Array(await res.arrayBuffer());
  const entries = parseEntryBundle(body);
  if (offset < 0 || offset >= entries.length) {
    throw new Error(`Entry offset out of range for tile (offset=${offset}, entries=${entries.length})`);
  }
  const text = Buffer.from(entries[offset]!).toString("utf8");
  return JSON.parse(text) as unknown;
}

async function main() {
  const indexArg = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  if (!indexArg) {
    console.error("Usage: pnpm index:resolve -- <rekor_log_index>");
    process.exit(1);
  }
  const logIndex = Number(indexArg);
  const entry = await fetchEntryByLogIndex(logIndex);
  const normalized = normalizeEntry(logIndex, entry);
  const payload = {
    resolvedAt: new Date().toISOString(),
    rekorBaseUrl: REKOR_BASE_URL,
    ...normalized,
  };

  const outDir = toAbsolutePath(OUT_DIR);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `rekor-entry-${logIndex}.json`);
  await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`✓ Resolved Rekor entry ${logIndex}`);
  console.log(`✓ Saved: ${outPath}`);
  if (payload.kind === "dsse") {
    const dsse = payload.dsse as { signatures?: unknown[] } | null;
    console.log(`✓ DSSE signatures: ${Array.isArray(dsse?.signatures) ? dsse!.signatures!.length : 0}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
