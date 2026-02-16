/**
 * DEPRECATED
 *
 * Local Rekor submission is deprecated for this template.
 * Use GitHub Actions workflow ".github/workflows/rekor-keyless-demo.yml" instead.
 *
 * Submit latest FCP statement-attestation to Rekor v2 as DSSE/in-toto.
 *
 * Flow:
 * 1. Read latest .fide/statement-attestations/.../*.json
 * 2. Build in-toto Statement payload with explicit FCP predicate type
 * 3. Wrap payload in DSSE envelope and sign (ECDSA P-256)
 * 4. POST /api/v2/log/entries with dsseRequestV002
 * 5. Write response/proof JSON to .fide/rekor-proofs/YYYY/MM/DD/
 */

import {
  createHash,
  createSign,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

const ATTESTOR_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const FIDE_ROOT = join(ATTESTOR_ROOT, ".fide");

const STATEMENT_ATTESTATIONS_PATH =
  process.env.FCP_STATEMENT_ATTESTATIONS_PATH ??
  process.env.FCP_ATTESTATIONS_PATH ??
  join(FIDE_ROOT, "statement-attestations");

const REKOR_PROOFS_PATH =
  process.env.FCP_REKOR_PROOFS_PATH ?? join(FIDE_ROOT, "rekor-proofs");

const REKOR_BASE_URL = (process.env.REKOR_BASE_URL ?? "https://log2025-1.rekor.sigstore.dev").replace(/\/+$/, "");
const REKOR_ENTRIES_URL = `${REKOR_BASE_URL}/api/v2/log/entries`;
const REKOR_TIMEOUT_MS = Number(process.env.REKOR_TIMEOUT_MS ?? "30000");
const REKOR_KEY_DETAILS = process.env.REKOR_KEY_DETAILS ?? "PKIX_ECDSA_P256_SHA_256";
const DSSE_PAYLOAD_TYPE = "application/vnd.in-toto+json";
const FCP_PREDICATE_TYPE = "https://fide.work/fcp/predicate/statement-attestation/v1";

interface StatementAttestationLine {
  m: string;
  u: string;
  r: string;
  s: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function utcDatePartition(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

async function findLatestAttestation(basePath: string): Promise<string | null> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(full);
      }
    }
  }

  await walk(basePath);
  if (files.length === 0) return null;
  files.sort();
  return files[files.length - 1]!;
}

function makeDSSEPAE(payloadType: string, payloadBytes: Uint8Array): Buffer {
  const pt = Buffer.from(payloadType, "utf8");
  const parts = [
    Buffer.from("DSSEv1 ", "utf8"),
    Buffer.from(String(pt.length), "utf8"),
    Buffer.from(" ", "utf8"),
    pt,
    Buffer.from(" ", "utf8"),
    Buffer.from(String(payloadBytes.length), "utf8"),
    Buffer.from(" ", "utf8"),
    Buffer.from(payloadBytes),
  ];
  return Buffer.concat(parts);
}

async function main() {
  console.error(
    "DEPRECATED: local rekor.ts disabled. Use GitHub Actions workflow ".concat(
      '".github/workflows/rekor-keyless-demo.yml".'
    )
  );
  process.exit(1);

  console.log("📡 Rekor submit (v2 DSSE/in-toto) from latest statement-attestation\n");
  console.log("   Rekor URL:", REKOR_ENTRIES_URL);

  const latestPath = await findLatestAttestation(STATEMENT_ATTESTATIONS_PATH);
  if (!latestPath) {
    console.log("ℹ No statement-attestations found.");
    console.log("  Run: pnpm --filter fide-attestor-template seed");
    return;
  }

  const artifactBytes = await readFile(latestPath);
  const artifactText = artifactBytes.toString("utf8").trim();
  if (!artifactText) {
    throw new Error(`Latest attestation file is empty: ${latestPath}`);
  }
  const attestation = JSON.parse(artifactText) as StatementAttestationLine;

  const artifactDigestBytes = createHash("sha256").update(artifactBytes).digest();
  const artifactDigestHex = bytesToHex(artifactDigestBytes);

  const privatePem = process.env.REKOR_ECDSA_PRIVATE_KEY_PEM;
  const publicPem = process.env.REKOR_ECDSA_PUBLIC_KEY_PEM;
  const keyPair =
    privatePem && publicPem
      ? {
          privateKey: createPrivateKey(privatePem),
          publicKey: createPublicKey(publicPem),
          generated: false,
        }
      : (() => {
          const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
          return { privateKey, publicKey, generated: true };
        })();

  const inTotoStatement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: basename(latestPath),
        digest: {
          sha256: artifactDigestHex,
        },
      },
    ],
    predicateType: FCP_PREDICATE_TYPE,
    predicate: {
      attestation: {
        m: attestation.m,
        u: attestation.u,
        r: attestation.r,
        s: attestation.s,
      },
      source: {
        path: latestPath,
      },
    },
  };

  const payloadBytes = Buffer.from(JSON.stringify(inTotoStatement), "utf8");
  const pae = makeDSSEPAE(DSSE_PAYLOAD_TYPE, payloadBytes);
  const signer = createSign("sha256");
  signer.update(pae);
  signer.end();
  const dsseSignatureBytes = signer.sign(keyPair.privateKey);
  const publicKeyDer = keyPair.publicKey.export({ type: "spki", format: "der" });

  const payload = {
    dsseRequestV002: {
      envelope: {
        payload: bytesToBase64(payloadBytes),
        payloadType: DSSE_PAYLOAD_TYPE,
        signatures: [
          {
            sig: bytesToBase64(dsseSignatureBytes),
            keyid: "",
          },
        ],
      },
      verifiers: [
        {
          publicKey: {
            rawBytes: bytesToBase64(publicKeyDer),
          },
          keyDetails: REKOR_KEY_DETAILS,
        },
      ],
    },
  };

  console.log("   Artifact:", latestPath);
  console.log("   Artifact SHA256:", artifactDigestHex);
  console.log("   DSSE payload type:", DSSE_PAYLOAD_TYPE);
  console.log("   Predicate type:", FCP_PREDICATE_TYPE);
  console.log("   Key:", keyPair.generated ? "generated ephemeral P-256 key" : "env-provided P-256 key");
  console.log("   Submitting...");

  const response = await fetch(REKOR_ENTRIES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REKOR_TIMEOUT_MS),
  });

  const bodyText = await response.text();
  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    bodyJson = { raw: bodyText };
  }

  const now = new Date();
  const outDir = join(REKOR_PROOFS_PATH, utcDatePartition(now));
  await mkdir(outDir, { recursive: true });

  const attestationBase = basename(latestPath, ".json");
  const outFile = join(
    outDir,
    `${attestationBase}.rekor-v2.json`
  );
  const latestFile = join(REKOR_PROOFS_PATH, "latest.json");

  const proofRecord = {
    submittedAt: now.toISOString(),
    mode: "dsse",
    rekor: {
      url: REKOR_ENTRIES_URL,
      status: response.status,
      ok: response.ok,
    },
    artifact: {
      path: latestPath,
      sizeBytes: artifactBytes.length,
      sha256: artifactDigestHex,
    },
    inToto: {
      payloadType: DSSE_PAYLOAD_TYPE,
      predicateType: FCP_PREDICATE_TYPE,
    },
    request: payload,
    response: bodyJson,
  };

  await writeFile(outFile, JSON.stringify(proofRecord, null, 2) + "\n", "utf8");
  await writeFile(latestFile, JSON.stringify(proofRecord, null, 2) + "\n", "utf8");

  if (!response.ok) {
    console.error(`❌ Rekor submit failed (${response.status})`);
    console.error("   Saved response:", outFile);
    process.exit(1);
  }

  console.log("✅ Rekor DSSE submit succeeded");
  console.log("   Saved proof:", outFile);
  console.log("   Latest proof:", latestFile);
}

main().catch((err) => {
  console.error("❌ Rekor submit error:", err);
  process.exit(1);
});
