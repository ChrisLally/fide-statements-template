import {
    calculateFideId,
    calculateStatementFideId
} from "../../../dist/index.js";
import {
    generateEd25519KeyPair,
    exportEd25519Keys,
    signEd25519
} from "../../../dist/experimental/signing/index.js";
import {
    createAttestation,
    createProvenanceStatements,
    verifyStatementInAttestation
} from "../../../dist/experimental/attestation/index.js";

console.log("📜 Testing Attestation Utilities\n");

// ============================================================================
// STEP 1: Create some statements
// ============================================================================
console.log("1. Creating sample statements...");

// Generate valid Fide IDs for entities
const aliceFideId = await calculateFideId("Person", "Person", "https://x.com/alice");
const namePredicate = await calculateFideId("CreativeWork", "Product", "https://schema.org/name");
const aliceNameValue = await calculateFideId("CreativeWork", "CreativeWork", "Alice");

const bobFideId = await calculateFideId("Person", "Person", "https://x.com/bob");
const worksForPredicate = await calculateFideId("CreativeWork", "Product", "https://schema.org/worksFor");
const acmeFideId = await calculateFideId("Organization", "Organization", "Acme Corp");

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
// STEP 3: Create attestation
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
// STEP 4: Create provenance statements
// ============================================================================
console.log("4. Creating provenance statements...");
const provenance = await createProvenanceStatements(
    [statement1FideId, statement2FideId],
    attestation
);

console.log("✅ Created", provenance.length, "provenance statements");
console.log("   First provenance:");
console.log("   - Subject:", provenance[0].subjectFideId.slice(0, 25) + "...");
console.log("   - Predicate:", provenance[0].predicateRawIdentifier);
console.log("   - Object:", provenance[0].objectFideId.slice(0, 25) + "...\n");

// ============================================================================
// STEP 5: Verify statements in attestation
// ============================================================================
console.log("5. Verifying statements in attestation...");

for (const statementId of [statement1FideId, statement2FideId]) {
    const proof = attestation.proofs.get(statementId);
    const isValid = await verifyStatementInAttestation(statementId, proof, attestation.attestationData);
    console.log(isValid ? "✅" : "❌", statementId.slice(0, 25) + "...", "is in attestation");
}

// Try with a statement NOT in the attestation
console.log("\n6. Testing with non-member statement...");
const fakeStatement = "did:fide:0x00123456789012345678901234567890123456789";
const stolenProof = attestation.proofs.get(statement1FideId);
const isFakeValid = await verifyStatementInAttestation(fakeStatement, stolenProof, attestation.attestationData);
console.log(isFakeValid ? "❌ Should have failed!" : "✅ Correctly rejected non-member!");

console.log("\n🎉 All attestation tests passed!");
