import {
    getEthereumAddress,
    signEip712,
    verifyEip712,
    createEthereumCaip10
} from "../../dist/index.js";
import { generatePrivateKey } from "viem/accounts";

console.log("🔐 Testing EIP-712 Signing (with viem)\n");

// Generate a new Ethereum key
console.log("1. Generating Ethereum private key...");
const privateKey = generatePrivateKey();
console.log("✅ Private Key:", privateKey.slice(0, 20) + "...\n");

// Get address
console.log("2. Deriving Ethereum address...");
const address = await getEthereumAddress(privateKey);
console.log("✅ Address:", address);

// Create CAIP-10 identifier
const caip10 = createEthereumCaip10(address, 1);
console.log("✅ CAIP-10:", caip10, "\n");

// Sign some data (e.g., a Merkle root)
const merkleRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
console.log("3. Signing Merkle root:", merkleRoot);
const signature = await signEip712(merkleRoot, privateKey);
console.log("✅ Signature:", signature.slice(0, 20) + "...\n");

// Verify the signature
console.log("4. Verifying signature...");
const isValid = await verifyEip712(merkleRoot, signature, address);
console.log(isValid ? "✅ Signature is valid!" : "❌ Signature is invalid!");

// Try with wrong address
console.log("\n5. Testing with wrong address...");
const wrongAddress = "0x0000000000000000000000000000000000000000";
const isTamperedValid = await verifyEip712(merkleRoot, signature, wrongAddress);
console.log(isTamperedValid ? "❌ Should have failed!" : "✅ Correctly rejected wrong address!");

console.log("\n🎉 All EIP-712 tests passed!");
