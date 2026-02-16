import {
    calculateFideId,
    calculateStatementFideId
} from "../../../dist/index.js";
import {
    createAttestation,
    verifyAttestation
} from "../../../dist/experimental/attestation/index.js";
import {
    generateEd25519KeyPair,
    exportEd25519Keys,
    signEd25519
} from "../../../dist/experimental/signing/index.js";

console.log("🔍 Testing Attestation Verification\n");

let failures = 0;
let checks = 0;

// Setup: Create attestation
console.log("Setting up test attestation...");
const aliceFideId = await calculateFideId("Person", "Person", "https://x.com/alice");
const namePredicate = await calculateFideId("CreativeWork", "Product", "https://schema.org/name");
const aliceNameValue = await calculateFideId("CreativeWork", "CreativeWork", "Alice");

const statement1FideId = await calculateStatementFideId(aliceFideId, namePredicate, aliceNameValue);
const statement2FideId = await calculateStatementFideId(
    await calculateFideId("Person", "Person", "https://x.com/bob"),
    await calculateFideId("CreativeWork", "Product", "https://schema.org/worksFor"),
    await calculateFideId("Organization", "Organization", "Acme Corp")
);

const keyPair = await generateEd25519KeyPair();
const exported = await exportEd25519Keys(keyPair);
const caip10User = `ed25519::${exported.address}`;

const attestation = await createAttestation(
    [statement1FideId, statement2FideId],
    {
        method: 'ed25519',
        caip10User,
        sign: (root) => signEd25519(root, keyPair.privateKey)
    }
);

// Test 1: Verify valid attestation
console.log("\n1. Testing verifyAttestation with valid attestation...");
checks += 1;
try {
    const proof = attestation.proofs.get(statement1FideId);
    if (!proof) {
        failures += 1;
        console.error("  ❌ No proof found for statement");
    } else {
        const isValid = await verifyAttestation(
            statement1FideId,
            proof,
            attestation.attestationData,
            {
                method: 'ed25519',
                publicKeyOrAddress: keyPair.publicKey
            }
        );
        
        if (!isValid) {
            failures += 1;
            console.error("  ❌ Valid attestation was rejected");
        } else {
            console.log("  ✅ Valid attestation verified successfully");
        }
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 2: Verify with invalid statement
console.log("\n2. Testing verifyAttestation with invalid statement...");
checks += 1;
try {
    const fakeStatement = "did:fide:0x00123456789012345678901234567890123456789";
    const proof = attestation.proofs.get(statement1FideId); // Use proof for different statement
    
    const isValid = await verifyAttestation(
        fakeStatement,
        proof,
        attestation.attestationData,
        {
            method: 'ed25519',
            publicKeyOrAddress: keyPair.publicKey
        }
    );
    
    if (isValid) {
        failures += 1;
        console.error("  ❌ Invalid attestation was accepted");
    } else {
        console.log("  ✅ Invalid attestation correctly rejected");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 3: Verify with wrong public key
console.log("\n3. Testing verifyAttestation with wrong public key...");
checks += 1;
try {
    const wrongKeyPair = await generateEd25519KeyPair();
    const proof = attestation.proofs.get(statement1FideId);
    
    const isValid = await verifyAttestation(
        statement1FideId,
        proof,
        attestation.attestationData,
        {
            method: 'ed25519',
            publicKeyOrAddress: wrongKeyPair.publicKey
        }
    );
    
    if (isValid) {
        failures += 1;
        console.error("  ❌ Attestation verified with wrong public key");
    } else {
        console.log("  ✅ Attestation correctly rejected with wrong public key");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 4: Verify with string attestation data
console.log("\n4. Testing verifyAttestation with string attestation data...");
checks += 1;
try {
    const proof = attestation.proofs.get(statement1FideId);
    const isValid = await verifyAttestation(
        statement1FideId,
        proof,
        attestation.rawIdentifier, // Pass raw identifier string
        {
            method: 'ed25519',
            publicKeyOrAddress: keyPair.publicKey
        }
    );
    
    if (!isValid) {
        failures += 1;
        console.error("  ❌ Failed to verify with string attestation data");
    } else {
        console.log("  ✅ Verified with string attestation data");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) failed`);
    process.exit(1);
}

console.log(`\n✅ All ${checks} attestation verification tests passed`);
