import {
    generateEd25519KeyPair,
    exportEd25519Keys,
    signEd25519,
    verifyEd25519
} from "../../../dist/experimental/signing/index.js";

console.log("🔐 Testing Ed25519 Signing\n");

// Generate a new key pair
console.log("1. Generating Ed25519 key pair...");
const keyPair = await generateEd25519KeyPair();
console.log("✅ Key pair generated\n");

// Export keys
console.log("2. Exporting keys...");
const exported = await exportEd25519Keys(keyPair);
console.log("✅ Public Key:", exported.publicKeyHex.slice(0, 32) + "...");
console.log("✅ Address:", exported.address);
console.log("✅ Private Key:", exported.privateKeyHex.slice(0, 32) + "...\n");

// Sign some data
const message = "Hello, Fide Context Protocol!";
console.log("3. Signing message:", message);
const signature = await signEd25519(message, keyPair.privateKey);
console.log("✅ Signature:", signature.slice(0, 32) + "...\n");

// Verify the signature
console.log("4. Verifying signature...");
const isValid = await verifyEd25519(message, signature, keyPair.publicKey);
console.log(isValid ? "✅ Signature is valid!" : "❌ Signature is invalid!");

// Try with wrong message
console.log("\n5. Testing with tampered message...");
const isTamperedValid = await verifyEd25519("Tampered message", signature, keyPair.publicKey);
console.log(isTamperedValid ? "❌ Should have failed!" : "✅ Correctly rejected tampered message!");

console.log("\n🎉 All tests passed!");
