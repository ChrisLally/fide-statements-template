import {
    buildStatementBatch,
    createAttestation,
    formatAttestationForJSONL,
    generateRegistryPath,
    generateJSONLFilename,
    generateEd25519KeyPair,
    exportEd25519Keys,
    signEd25519
} from "../../dist/index.js";
import { writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "crypto";

console.log("📡 Broadcasting with Rekor Example (Simulated)\n");

/**
 * Determine the next sequence number for a time window
 * (Same logic as original example)
 */
async function determineNextSequence(directoryPath, date, maxFileSizeBytes = 50 * 1024 * 1024) {
    try {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const timeWindowPrefix = `${year}-${month}-${day}-${hours}${minutes}`;

        let files;
        try {
            files = await readdir(directoryPath);
        } catch (error) {
            if (error.code === 'ENOENT') return 1;
            throw error;
        }

        const matchingFiles = files.filter(file =>
            file.startsWith(timeWindowPrefix) && file.endsWith('.jsonl')
        );

        if (matchingFiles.length === 0) return 1;

        const sequences = matchingFiles.map(file => {
            const match = file.match(new RegExp(`^${timeWindowPrefix}-(\\d+)\\.jsonl$`));
            return match ? parseInt(match[1], 10) : 0;
        }).filter(seq => seq > 0);

        if (sequences.length === 0) return 1;

        const latestSequence = Math.max(...sequences);
        const latestFilename = generateJSONLFilename(date, latestSequence);
        const latestFilePath = join(directoryPath, latestFilename);

        try {
            const fileStats = await stat(latestFilePath);
            if (fileStats.size < maxFileSizeBytes) return latestSequence;
            else return latestSequence + 1;
        } catch (error) {
            if (error.code === 'ENOENT') return latestSequence + 1;
            throw error;
        }
    } catch (error) {
        console.error("Error determining sequence:", error);
        return 1;
    }
}

// Step 1: Create statements
console.log("1. Creating statements...");
const statements = await buildStatementBatch([
    {
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'schema:name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    },
    {
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'schema:url', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'https://x.com/alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    }
]);

const statementFideIds = statements.map(s => s.statementFideId).filter(Boolean);
console.log("✅ Created", statements.length, "statements\n");

// Step 2: Create attestation
console.log("2. Creating attestation...");
const keyPair = await generateEd25519KeyPair();
const exported = await exportEd25519Keys(keyPair);
const caip10User = `ed25519::${exported.address}`;

const attestation = await createAttestation(statementFideIds, {
    method: 'ed25519',
    caip10User,
    sign: (root) => signEd25519(root, keyPair.privateKey)
});

console.log("✅ Attestation created");
console.log("   Attestation Fide ID:", attestation.attestationFideId.slice(0, 30) + "...");
console.log("   Merkle Root:", attestation.merkleRoot);

// Step 3: Log to Rekor (Simulated)
console.log("\n3. Logging Merkle Root to Rekor (Simulated)...");

// In a real implementation:
// const rekorEntry = await rekorClient.createEntry({
//   signature: attestation.attestationData.s,
//   publicKey: exported.publicKey,
//   data: { hash: { algorithm: "sha256", value: attestation.merkleRoot } }
// });

const simulatedRekorEntry = {
    uuid: "ff05d9...",
    logIndex: 12345,
    integratedTime: Date.now(),
    body: {
        kind: "hashedrekord",
        apiVersion: "0.0.1",
        spec: {
            signature: {
                content: attestation.attestationData.s,
                publicKey: { content: exported.publicKey }
            },
            data: {
                hash: { algorithm: "sha256", value: attestation.merkleRoot }
            }
        }
    }
};

console.log("✅ Logged to Rekor!");
console.log("   Entry UUID:", simulatedRekorEntry.uuid);
console.log("   Timestamp:", new Date(simulatedRekorEntry.integratedTime).toISOString());

// Step 4: Format for JSONL
console.log("\n4. Formatting for JSONL...");
const jsonlAttestation = await formatAttestationForJSONL(attestation, statements);

// ADD REKOR PROOF TO JSONL (If supported by schema, otherwise as sidecar)
// For now, let's just log it here. In a real implementation, we might attach it to the attestation metadata.
jsonlAttestation.anchored_at = simulatedRekorEntry.integratedTime; // Adding timestamp from Rekor
jsonlAttestation.rekor_uuid = simulatedRekorEntry.uuid; // Adding UUID

console.log("✅ Formatted for JSONL output with Rekor metadata");
console.log("   Timestamp (Rekor):", jsonlAttestation.anchored_at);
console.log();

// Step 5: Generate registry paths and determine sequence
console.log("5. Generating registry paths (UTC)...");
const now = new Date();
const registryPath = generateRegistryPath(now);
const outputDir = join(process.cwd(), 'examples', '_rekor_test_output', 'attestations', registryPath); // Changed output dir for test

// Determine the correct sequence number based on existing files
console.log("   Determining sequence number...");
const sequence = await determineNextSequence(outputDir, now);
const filename = generateJSONLFilename(now, sequence);
console.log("   Sequence:", sequence, sequence === 1 ? "(new file)" : "(appending or rollover)");

console.log("✅ Registry path:", registryPath);
console.log("✅ Filename:", filename);
console.log("   Full path: _rekor_test_output/attestations/" + registryPath + "/" + filename);
console.log();

// Step 6: Write JSONL file
console.log("6. Writing JSONL file...");
const outputPath = join(outputDir, filename);

await mkdir(outputDir, { recursive: true });

// Append to file if sequence matches existing file, otherwise create new
const fileExists = await stat(outputPath).then(() => true).catch(() => false);
if (fileExists) {
    // Append new line to existing file
    await writeFile(outputPath, JSON.stringify(jsonlAttestation) + '\n', { flag: 'a' });
    console.log("   Mode: Append to existing file");
} else {
    // Create new file
    await writeFile(outputPath, JSON.stringify(jsonlAttestation) + '\n', 'utf-8');
    console.log("   Mode: Create new file");
}

console.log("✅ JSONL file written:");
console.log("   Path:", outputPath);
console.log("   Full JSONL content:");
console.log(JSON.stringify(jsonlAttestation, null, 2));
console.log();

console.log("🎉 Broadcasting with Rekor example complete!");
