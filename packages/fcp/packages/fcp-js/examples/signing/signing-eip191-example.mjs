// Check if viem is available
let viemAvailable = false;
try {
    await import('viem');
    viemAvailable = true;
} catch {
    console.log("⚠️  viem not available. Install it to run this example:");
    console.log("   pnpm add viem");
    process.exit(0);
}

import { signEip191, verifyEip191 } from "../../dist/index.js";
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

console.log("✍️  EIP-191 Signing Example\n");

// Example 1: Generate key and sign
console.log("1. Generating Ethereum key pair...");
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const address = account.address;

console.log("✅ Private key generated");
console.log("   Address:", address);
console.log();

// Example 2: Sign a message
console.log("2. Signing message with EIP-191...");
const message = "Hello, FCP! This is a test message.";
const signature = await signEip191(message, privateKey);

console.log("✅ Message signed");
console.log("   Message:", message);
console.log("   Signature:", signature.slice(0, 30) + "...");
console.log();

// Example 3: Verify signature
console.log("3. Verifying signature...");
const isValid = await verifyEip191(message, signature, address);

if (isValid) {
    console.log("✅ Signature verified successfully");
} else {
    console.log("❌ Signature verification failed");
}
console.log();

// Example 4: Verify with wrong message (should fail)
console.log("4. Testing verification with wrong message...");
const wrongMessage = "Different message";
const isValidWrong = await verifyEip191(wrongMessage, signature, address);

if (!isValidWrong) {
    console.log("✅ Correctly rejected wrong message");
} else {
    console.log("❌ Should have rejected wrong message");
}
console.log();

// Example 5: Sign Merkle root (as used in attestations)
console.log("5. Signing Merkle root (attestation use case)...");
const merkleRoot = "0x62724d7c07c7e9148f5aca9340c97844a1b8c5e8d8e8e8e8e8e8e8e8e8e8e8e8";
const merkleSignature = await signEip191(merkleRoot, privateKey);
const merkleValid = await verifyEip191(merkleRoot, merkleSignature, address);

console.log("✅ Merkle root signed and verified");
console.log("   Root:", merkleRoot.slice(0, 30) + "...");
console.log("   Signature:", merkleSignature.slice(0, 30) + "...");
console.log("   Verified:", merkleValid ? "✅" : "❌");
console.log();

console.log("🎉 EIP-191 signing example complete!");
console.log("\n💡 Use EIP-191 signing in attestations:");
console.log("   method: 'eip191'");
console.log("   caip10User: `eip191:1:${address}`");
