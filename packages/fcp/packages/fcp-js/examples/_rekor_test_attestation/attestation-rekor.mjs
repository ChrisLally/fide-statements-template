import {
    calculateFideId,
    calculateStatementFideId,
    generateEd25519KeyPair,
    exportEd25519Keys,
    signEd25519,
    createAttestation,
    createProvenanceStatements,
    verifyStatementInAttestation
} from "../../dist/index.js";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REKOR_BASE_URL = (process.env.REKOR_BASE_URL ?? "https://log2025-1.rekor.sigstore.dev").replace(/\/+$/, "");
const REKOR_API_VERSION = process.env.REKOR_API_VERSION ?? "2";
const REKOR_KEY_DETAILS = process.env.REKOR_KEY_DETAILS ?? "PKIX_ECDSA_P256_SHA_256";
const REKOR_LOG_ENTRIES_URL = `${REKOR_BASE_URL}/api/v${REKOR_API_VERSION}/log/entries`;
const REKOR_TIMEOUT_MS = Number(process.env.REKOR_TIMEOUT_MS ?? "30000");
const REKOR_OUTPUT_DIR = process.env.REKOR_OUTPUT_DIR ?? join(process.cwd(), "packages", "fcp", "examples", "_rekor_test_attestation", "_output");

console.log("📜 Testing Attestation Utilities with REAL Rekor Integration\n");
console.log("   Rekor Base URL:", REKOR_BASE_URL);
console.log("   Rekor API Version:", REKOR_API_VERSION);
console.log("   Rekor Entries URL:", REKOR_LOG_ENTRIES_URL, "\n");

function hexToBase64(hex) {
    return Buffer.from(hex, "hex").toString("base64");
}

function bytesToBase64(bytes) {
    return Buffer.from(bytes).toString("base64");
}

function pemToBase64(pem) {
    return Buffer.from(pem, "utf8").toString("base64");
}

// ============================================================================
// STEP 1: Create some statements
// ============================================================================
console.log("1. Creating sample statements...");

// Generate valid Fide IDs for entities
const aliceFideId = await calculateFideId("Person", "Product", "https://x.com/alice");
const namePredicate = await calculateFideId("CreativeWork", "Product", "schema:name");
const aliceNameValue = await calculateFideId("CreativeWork", "CreativeWork", "Alice");

const bobFideId = await calculateFideId("Person", "Product", "https://x.com/bob");
const worksForPredicate = await calculateFideId("CreativeWork", "Product", "schema:worksFor");
const acmeFideId = await calculateFideId("Organization", "Product", "https://acme.example");

// Calculate statement Fide IDs
const statement1FideId = await calculateStatementFideId(aliceFideId, namePredicate, aliceNameValue);
const statement2FideId = await calculateStatementFideId(bobFideId, worksForPredicate, acmeFideId);

console.log("✅ Statement 1:", statement1FideId.slice(0, 30) + "...");
console.log("✅ Statement 2:", statement2FideId.slice(0, 30) + "...\n");

// ============================================================================
// STEP 2: Generate signing key
// ============================================================================
console.log("2. Generating Ed25519 signing key...");
const keyPair = await generateEd25519KeyPair();
const exported = await exportEd25519Keys(keyPair);
const caip10User = `ed25519::${exported.address}`;
console.log("✅ CAIP-10 User:", caip10User.slice(0, 40) + "...\n");

// ============================================================================
// STEP 3: Create attestation (Anchor)
// ============================================================================
console.log("3. Creating attestation...");
const attestation = await createAttestation(
    [statement1FideId, statement2FideId],
    {
        method: 'ed25519',
        caip10User,
        sign: (root) => signEd25519(root, keyPair.privateKey)
    }
);

console.log("✅ Attestation Fide ID:", attestation.attestationFideId.slice(0, 30) + "...");
console.log("✅ Merkle Root:", attestation.merkleRoot.slice(0, 32) + "...");
console.log("✅ Signature:", attestation.attestationData.s.slice(0, 32) + "...\n");

// ============================================================================
// STEP 3B: Create Rekor witness signature (ECDSA P-256, no SDK helper)
// ============================================================================
console.log("3b. Creating Rekor witness signature (ECDSA P-256)...");
const rekorArtifact = Buffer.from(attestation.merkleRoot, "hex");
const rekorDigestBytes = createHash("sha256").update(rekorArtifact).digest();

const { privateKey: rekorPrivateKey, publicKey: rekorPublicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1"
});

const signer = createSign("sha256");
signer.update(rekorArtifact);
signer.end();
const rekorSignatureBytes = signer.sign(rekorPrivateKey);
const rekorPublicKeyDerBytes = rekorPublicKey.export({ type: "spki", format: "der" });
const rekorPublicKeyPem = rekorPublicKey.export({ type: "spki", format: "pem" });

console.log("✅ Rekor witness key generated");
console.log("✅ Rekor artifact bytes:", rekorArtifact.length);
console.log("✅ Rekor digest (sha256) ready\n");

// ============================================================================
// STEP 4: Log to Rekor (REAL)
// ============================================================================
console.log("4. Logging to Rekor: " + REKOR_LOG_ENTRIES_URL);

// Build payload for Rekor v1 or v2.
// We anchor the Merkle root as the digest value.
const rekorPayload = REKOR_API_VERSION === "2"
    ? {
        hashedRekordRequestV002: {
            digest: bytesToBase64(rekorDigestBytes),
            signature: {
                content: bytesToBase64(rekorSignatureBytes),
                verifier: {
                    publicKey: {
                        rawBytes: bytesToBase64(rekorPublicKeyDerBytes)
                    },
                    keyDetails: REKOR_KEY_DETAILS
                }
            }
        }
    }
    : {
        kind: "hashedrekord",
        apiVersion: "0.0.1",
        spec: {
            signature: {
                content: bytesToBase64(rekorSignatureBytes),
                publicKey: {
                    content: pemToBase64(rekorPublicKeyPem)
                }
            },
            data: {
                hash: {
                    algorithm: "sha256",
                    value: Buffer.from(rekorDigestBytes).toString("hex")
                }
            }
        }
    };

console.log("   Sending payload...");
try {
    const response = await fetch(REKOR_LOG_ENTRIES_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(rekorPayload),
        signal: AbortSignal.timeout(REKOR_TIMEOUT_MS)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Rekor API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    await mkdir(REKOR_OUTPUT_DIR, { recursive: true });
    const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
    const responsePath = join(REKOR_OUTPUT_DIR, `rekor-response-${nowIso}.json`);
    const latestPath = join(REKOR_OUTPUT_DIR, "rekor-response-latest.json");
    await writeFile(responsePath, JSON.stringify(result, null, 2) + "\n", "utf8");
    await writeFile(latestPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    console.log("✅ Successfully Logged to Rekor!");
    console.log("   Saved response:", responsePath);
    console.log("   Latest response:", latestPath);
    if (REKOR_API_VERSION === "1") {
        // Rekor v1 response is keyed by UUID, e.g. { "<uuid>": { ... } }
        const uuid = Object.keys(result)[0];
        const entry = result[uuid];
        console.log("   UUID:", uuid);
        console.log("   Log Index:", entry.logIndex);
        console.log("   Integrated Time:", new Date(entry.integratedTime * 1000).toISOString()); // v1 uses seconds
        console.log("   Body (Base64 decoded partial):", Buffer.from(entry.body, 'base64').toString().slice(0, 50) + "...");
    } else {
        console.log("   Log Index:", result.logIndex ?? "(unknown)");
        if (result.integratedTime) {
            console.log("   Integrated Time:", new Date(result.integratedTime * 1000).toISOString());
        }
        console.log("   Response Keys:", Object.keys(result).join(", "));
    }

} catch (error) {
    console.error("❌ Failed to log to Rekor:", error.message);
    process.exit(1);
}

// ============================================================================
// STEP 5: Create provenance statements (Linking back to Attestation)
// ============================================================================
console.log("\n5. Creating provenance statements...");
const provenance = await createProvenanceStatements(
    [statement1FideId, statement2FideId],
    attestation
);

console.log("✅ Created", provenance.length, "provenance statements\n");

// ============================================================================
// STEP 6: Verify statements in attestation
// ============================================================================
console.log("6. Verifying statements in attestation...");

for (const statementId of [statement1FideId, statement2FideId]) {
    const proof = attestation.proofs.get(statementId);
    const isValid = await verifyStatementInAttestation(statementId, proof, attestation.attestationData);
    console.log(isValid ? "✅" : "❌", statementId.slice(0, 25) + "...", "is in attestation");
}

console.log("\n🎉 Attestation + Real Rekor Integration complete!");
