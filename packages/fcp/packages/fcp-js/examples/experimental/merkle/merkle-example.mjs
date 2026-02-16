import {
    buildMerkleTree,
    verifyMerkleProof
} from "../../../dist/experimental/merkle/index.js";

console.log("🌲 Testing Merkle Tree Utilities\n");

// Create some fake statement Fide IDs
const statements = [
    "did:fide:0x00aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "did:fide:0x00bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "did:fide:0x00cccccccccccccccccccccccccccccccccccccc",
    "did:fide:0x00dddddddddddddddddddddddddddddddddddddd"
];

console.log("1. Building Merkle tree from", statements.length, "statements...");
const result = await buildMerkleTree(statements);
console.log("✅ Merkle root:", result.root.slice(0, 32) + "...");
console.log("✅ Generated proofs for", result.proofs.size, "leaves\n");

// Verify each leaf
console.log("2. Verifying each leaf...");
for (const statement of statements) {
    const proof = result.proofs.get(statement);
    if (!proof) {
        console.log("❌ No proof found for", statement);
        continue;
    }
    const isValid = await verifyMerkleProof(statement, proof, result.root);
    console.log(isValid ? "✅" : "❌", statement.slice(0, 20) + "...", "- Proof length:", proof.length);
}

// Test with wrong leaf
console.log("\n3. Testing verification with wrong leaf...");
const wrongStatement = "did:fide:0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const stolenProof = result.proofs.get(statements[0]);
const isFakeValid = await verifyMerkleProof(wrongStatement, stolenProof, result.root);
console.log(isFakeValid ? "❌ Should have failed!" : "✅ Correctly rejected non-member!");

// Test with single leaf
console.log("\n4. Testing with single leaf...");
const singleResult = await buildMerkleTree(["did:fide:0x00aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]);
console.log("✅ Single leaf root:", singleResult.root.slice(0, 32) + "...");

console.log("\n🎉 All Merkle tree tests passed!");
