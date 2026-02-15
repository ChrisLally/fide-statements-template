import {
    buildStatementBatch,
    createAttestation,
    formatAttestationForJSONL,
    generateRegistryPath,
    generateJSONLFilename,
    getEthereumAddress,
    signEip712,
    createEthereumCaip10
} from "../../dist/index.js";
import { writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../..");
const envPath = join(projectRoot, ".env");

let privateKey;
try {
    const envContent = readFileSync(envPath, "utf-8");
    const easMatch = envContent.match(/EAS_SIGNER_PRIVATE_KEY=(.+)/);
    if (easMatch && easMatch[1]) {
        privateKey = easMatch[1].trim().replace(/^["']|["']$/g, ""); // Remove quotes if present
    } else {
        throw new Error("EAS_SIGNER_PRIVATE_KEY not found in .env");
    }
} catch (error) {
    // Fallback to process.env if .env file doesn't exist or can't be read
    privateKey = process.env.EAS_SIGNER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error(
            "EAS_SIGNER_PRIVATE_KEY not found. Please set it in .env file or environment variable.\n" +
            "Expected format: EAS_SIGNER_PRIVATE_KEY=0x..."
        );
    }
}

// Validate private key format
if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
}
if (privateKey.length !== 66) {
    throw new Error(`Invalid private key length. Expected 66 characters (0x + 64 hex), got ${privateKey.length}`);
}

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

console.log("📡 Broadcasting Example (EIP-712 with EAS Signer)\n");

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

// Step 2: Get Ethereum address and create CAIP-10 identifier
console.log("2. Setting up EIP-712 signing...");
const address = await getEthereumAddress(privateKey);
const chainId = 1; // Ethereum Mainnet (change to 11155111 for Sepolia, etc.)
const caip10User = createEthereumCaip10(address, chainId);

console.log("✅ Ethereum Address:", address);
console.log("✅ CAIP-10 User:", caip10User);
console.log("   Chain ID:", chainId, chainId === 1 ? "(Mainnet)" : chainId === 11155111 ? "(Sepolia)" : "");
console.log();

// Step 3: Create attestation
console.log("3. Creating attestation...");
const attestation = await createAttestation(statementFideIds, {
    method: 'eip712',
    caip10User,
    sign: async (root) => {
        // EIP-712 signing requires the private key
        return await signEip712(root, privateKey);
    }
});

console.log("✅ Attestation created");
console.log("   Attestation Fide ID:", attestation.attestationFideId.slice(0, 30) + "...\n");

// Step 4: Format for JSONL (lean format with short keys)
console.log("4. Formatting for JSONL...");
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
console.log("\n📝 Note: EIP-712 requires chain ID in CAIP-10 format.");
console.log("   Current format:", caip10User);
console.log("   For Sepolia testnet, use chainId: 11155111");
