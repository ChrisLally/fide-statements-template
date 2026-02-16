import {
    batchStatementsWithRoot
} from "../../../dist/index.js";
import { createAttestation } from "../../../dist/experimental/attestation/index.js";
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

console.log("📡 Testing Broadcasting Helpers\n");

let failures = 0;
let checks = 0;

// Setup: Create statements and attestation
const { statements } = await batchStatementsWithRoot([
    {
        subject: { rawIdentifier: "https://x.com/alice", entityType: "Person", sourceType: "Product" },
        predicate: { rawIdentifier: "https://schema.org/name", entityType: "CreativeWork", sourceType: "Product" },
        object: { rawIdentifier: "Alice", entityType: "CreativeWork", sourceType: "CreativeWork" }
    }
]);

const statement1FideId = statements[0].statementFideId;

const keyPair = await generateEd25519KeyPair();
const exported = await exportEd25519Keys(keyPair);
const caip10User = `ed25519::${exported.address}`;

const attestation = await createAttestation(
    [statement1FideId],
    {
        method: 'ed25519',
        caip10User,
        sign: (root) => signEd25519(root, keyPair.privateKey)
    }
);

// Test 1: formatAttestationForJSONL
console.log("1. Testing formatAttestationForJSONL...");
checks += 1;
try {
    const jsonlAttestation = formatAttestationForJSONL(attestation, statements);
    
    if (!jsonlAttestation.m ||
        !jsonlAttestation.u ||
        !jsonlAttestation.r ||
        !jsonlAttestation.s ||
        !jsonlAttestation.t ||
        !Array.isArray(jsonlAttestation.d)) {
        failures += 1;
        console.error("  ❌ Missing required fields");
    } else if (jsonlAttestation.d.length !== statements.length) {
        failures += 1;
        console.error("  ❌ Statements count mismatch");
    } else if (jsonlAttestation.u !== caip10User) {
        failures += 1;
        console.error("  ❌ Signer mismatch");
    } else if (jsonlAttestation.m !== 'ed25519') {
        failures += 1;
        console.error("  ❌ Signature method mismatch");
    } else if (!jsonlAttestation.d[0] || !jsonlAttestation.d[0].s || !jsonlAttestation.d[0].sr) {
        failures += 1;
        console.error("  ❌ Statement format invalid (missing short keys)");
    } else {
        console.log("  ✅ Formatted attestation for JSONL");
        console.log("     Method:", jsonlAttestation.m);
        console.log("     User:", jsonlAttestation.u);
        console.log("     Root:", jsonlAttestation.r.slice(0, 20) + "...");
        console.log("     Statements:", jsonlAttestation.d.length);
        console.log("     First statement subject:", jsonlAttestation.d[0].s.slice(0, 20) + "...");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 2: generateRegistryPath with default date
console.log("\n2. Testing generateRegistryPath (default date)...");
checks += 1;
try {
    const path = generateRegistryPath();
    const parts = path.split('/');
    
    if (parts.length !== 3) {
        failures += 1;
        console.error("  ❌ Invalid path format, expected YYYY/MM/DD");
    } else if (parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
        failures += 1;
        console.error("  ❌ Invalid date format");
    } else {
        console.log("  ✅ Generated registry path:", path);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 3: generateRegistryPath with specific date (UTC)
console.log("\n3. Testing generateRegistryPath (specific UTC date)...");
checks += 1;
try {
    const date = new Date('2024-01-15T14:30:00Z');
    const path = generateRegistryPath(date);
    
    if (path !== '2024/01/15') {
        failures += 1;
        console.error(`  ❌ Expected '2024/01/15', got '${path}'`);
    } else {
        console.log("  ✅ Generated correct path for specific UTC date:", path);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 4: generateJSONLFilename with default
console.log("\n4. Testing generateJSONLFilename (default)...");
checks += 1;
try {
    const filename = generateJSONLFilename();
    const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{4})-(\d+)\.jsonl$/);
    
    if (!match) {
        failures += 1;
        console.error("  ❌ Invalid filename format");
    } else {
        console.log("  ✅ Generated JSONL filename:", filename);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 5: generateJSONLFilename with specific UTC date and sequence
console.log("\n5. Testing generateJSONLFilename (specific UTC date and sequence)...");
checks += 1;
try {
    const date = new Date('2024-01-15T14:00:00Z'); // UTC timestamp
    const filename = generateJSONLFilename(date, 1);
    
    if (filename !== '2024-01-15-1400-1.jsonl') {
        failures += 1;
        console.error(`  ❌ Expected '2024-01-15-1400-1.jsonl', got '${filename}'`);
    } else {
        console.log("  ✅ Generated correct filename:", filename);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 6: generateJSONLFilename with sequence > 1
console.log("\n6. Testing generateJSONLFilename (sequence > 1)...");
checks += 1;
try {
    const date = new Date('2024-01-15T14:00:00Z'); // UTC timestamp
    const filename = generateJSONLFilename(date, 3);
    
    if (filename !== '2024-01-15-1400-3.jsonl') {
        failures += 1;
        console.error(`  ❌ Expected '2024-01-15-1400-3.jsonl', got '${filename}'`);
    } else {
        console.log("  ✅ Generated correct filename with sequence:", filename);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 7: UTC timezone consistency
console.log("\n7. Testing UTC timezone consistency...");
checks += 1;
try {
    // Test that UTC timestamps produce consistent results regardless of local timezone
    const utcDate = new Date('2024-01-15T14:00:00Z');
    const filename1 = generateJSONLFilename(utcDate, 1);
    
    // Create same UTC time using different method
    const utcDate2 = new Date(Date.UTC(2024, 0, 15, 14, 0, 0));
    const filename2 = generateJSONLFilename(utcDate2, 1);
    
    if (filename1 !== filename2 || filename1 !== '2024-01-15-1400-1.jsonl') {
        failures += 1;
        console.error(`  ❌ UTC consistency check failed: '${filename1}' vs '${filename2}'`);
    } else {
        console.log("  ✅ UTC timezone consistency verified");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) failed`);
    process.exit(1);
}

console.log(`\n✅ All ${checks} broadcasting tests passed`);
