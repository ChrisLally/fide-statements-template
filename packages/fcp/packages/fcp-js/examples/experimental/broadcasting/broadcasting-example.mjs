import {
    buildStatementBatchWithRoot
} from "../../../dist/index.js";
import {
    createAttestation
} from "../../../dist/experimental/attestation/index.js";
import {
    formatAttestationForJSONL,
    generateRegistryPath,
    generateJSONLFilename
} from "../../../dist/experimental/broadcasting/index.js";
import {
    generateEd25519KeyPair,
    exportEd25519Keys,
    signEd25519
} from "../../../dist/experimental/signing/index.js";
import { writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

console.log("📡 Broadcasting Example\n");

/**
 * Determine the next sequence number for a time window
 * 
 * Checks existing files in the directory and returns the appropriate sequence:
 * - If no files exist, returns 1
 * - If the latest file is < 50MB, returns its sequence (for appending)
 * - If the latest file is >= 50MB, returns the next sequence (for rollover)
 * 
 * @param directoryPath - Path to the directory containing JSONL files
 * @param date - Date object
 * @param maxFileSizeBytes - Maximum file size before rollover (defaults to 50MB)
 * @returns Next sequence number to use
 */
async function determineNextSequence(directoryPath, date, maxFileSizeBytes = 50 * 1024 * 1024) {
    try {
        // Get time window prefix (e.g., "2024-01-15-1400")
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const timeWindowPrefix = `${year}-${month}-${day}-${hours}${minutes}`;
        
        // Read directory (may not exist yet)
        let files;
        try {
            files = await readdir(directoryPath);
        } catch (error) {
            // Directory doesn't exist yet, start with sequence 1
            if (error.code === 'ENOENT') {
                return 1;
            }
            throw error;
        }
        
        // Filter files matching the time window pattern (YYYY-MM-DD-HHmm-*.jsonl)
        const matchingFiles = files.filter(file => 
            file.startsWith(timeWindowPrefix) && file.endsWith('.jsonl')
        );
        
        if (matchingFiles.length === 0) {
            // No files for this time window, start with sequence 1
            return 1;
        }
        
        // Extract sequence numbers and find the highest
        const sequences = matchingFiles.map(file => {
            // Extract sequence from filename: YYYY-MM-DD-HHmm-{sequence}.jsonl
            const match = file.match(new RegExp(`^${timeWindowPrefix}-(\\d+)\\.jsonl$`));
            return match ? parseInt(match[1], 10) : 0;
        }).filter(seq => seq > 0);
        
        if (sequences.length === 0) {
            return 1;
        }
        
        const latestSequence = Math.max(...sequences);
        const latestFilename = generateJSONLFilename(date, latestSequence);
        const latestFilePath = join(directoryPath, latestFilename);
        
        // Check file size
        try {
            const fileStats = await stat(latestFilePath);
            const fileSizeBytes = fileStats.size;
            
            if (fileSizeBytes < maxFileSizeBytes) {
                // File is under size limit, append to it
                return latestSequence;
            } else {
                // File is at or over size limit, rollover to next sequence
                return latestSequence + 1;
            }
        } catch (error) {
            // File doesn't exist (shouldn't happen, but handle gracefully)
            if (error.code === 'ENOENT') {
                return latestSequence + 1;
            }
            throw error;
        }
    } catch (error) {
        console.error("Error determining sequence:", error);
        // Fallback to sequence 1 on error
        return 1;
    }
}

// Step 1: Create statements
console.log("1. Creating statements...");
const { statements, statementFideIds, root } = await buildStatementBatchWithRoot([
    {
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    },
    {
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/url', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'https://x.com/alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    }
]);

console.log("✅ Created", statements.length, "statements\n");
console.log("   Batch root:", root);

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
console.log("   Attestation Fide ID:", attestation.attestationFideId.slice(0, 30) + "...\n");

// Step 3: Format for JSONL (lean format with short keys)
console.log("3. Formatting for JSONL...");
const jsonlAttestation = formatAttestationForJSONL(attestation, statements);
console.log("✅ Formatted for JSONL output");
console.log("   Method:", jsonlAttestation.m);
console.log("   User:", jsonlAttestation.u);
console.log("   Root:", jsonlAttestation.r.slice(0, 20) + "...");
console.log("   Statements:", jsonlAttestation.d.length);
console.log("   Timestamp:", jsonlAttestation.t);
console.log();

// Step 5: Generate registry paths and determine sequence
console.log("5. Generating registry paths (UTC)...");
const now = new Date();
const registryPath = generateRegistryPath(now);
const outputDir = join(process.cwd(), 'examples', 'output', 'attestations', registryPath);

// Determine the correct sequence number based on existing files
console.log("   Determining sequence number...");
const sequence = await determineNextSequence(outputDir, now);
const filename = generateJSONLFilename(now, sequence);
console.log("   Sequence:", sequence, sequence === 1 ? "(new file)" : "(appending or rollover)");

console.log("✅ Registry path:", registryPath);
console.log("✅ Filename:", filename);
console.log("   Full path: attestations/" + registryPath + "/" + filename);
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

console.log("🎉 Broadcasting example complete!");
console.log("\n💡 Next steps:");
console.log("   - Review the JSONL file at:", outputPath);
console.log("   - Commit to Git repository");
console.log("   - Push to your registry repository");
