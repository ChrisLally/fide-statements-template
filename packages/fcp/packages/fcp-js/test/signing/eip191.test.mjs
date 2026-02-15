import { signEip191, verifyEip191 } from "../../dist/index.js";

// Check if viem is available
let viemAvailable = false;
try {
    await import('viem');
    viemAvailable = true;
} catch {
    console.log("⚠️  viem not available, skipping EIP-191 tests");
    console.log("   Install viem to run these tests: pnpm add viem");
    process.exit(0);
}

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

console.log("✍️  Testing EIP-191 Signing\n");

let failures = 0;
let checks = 0;

// Test 1: Sign and verify
console.log("1. Testing signEip191 and verifyEip191...");
checks += 1;
try {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const address = account.address;
    const message = "Hello, FCP!";
    
    const signature = await signEip191(message, privateKey);
    
    if (!signature.startsWith('0x') || signature.length < 130) {
        failures += 1;
        console.error("  ❌ Invalid signature format");
    } else {
        const isValid = await verifyEip191(message, signature, address);
        
        if (!isValid) {
            failures += 1;
            console.error("  ❌ Signature verification failed");
        } else {
            console.log("  ✅ Signed and verified successfully");
            console.log("     Address:", address.slice(0, 20) + "...");
            console.log("     Signature:", signature.slice(0, 20) + "...");
        }
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 2: Verify with wrong message
console.log("\n2. Testing verifyEip191 with wrong message...");
checks += 1;
try {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const address = account.address;
    const message = "Original message";
    
    const signature = await signEip191(message, privateKey);
    const isValid = await verifyEip191("Different message", signature, address);
    
    if (isValid) {
        failures += 1;
        console.error("  ❌ Verification passed with wrong message");
    } else {
        console.log("  ✅ Correctly rejected wrong message");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 3: Verify with wrong address
console.log("\n3. Testing verifyEip191 with wrong address...");
checks += 1;
try {
    const privateKey1 = generatePrivateKey();
    const account1 = privateKeyToAccount(privateKey1);
    const address1 = account1.address;
    
    const privateKey2 = generatePrivateKey();
    const account2 = privateKeyToAccount(privateKey2);
    const address2 = account2.address;
    
    const message = "Test message";
    const signature = await signEip191(message, privateKey1);
    const isValid = await verifyEip191(message, signature, address2); // Wrong address
    
    if (isValid) {
        failures += 1;
        console.error("  ❌ Verification passed with wrong address");
    } else {
        console.log("  ✅ Correctly rejected wrong address");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 4: Sign empty message
console.log("\n4. Testing signEip191 with empty message...");
checks += 1;
try {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const address = account.address;
    
    const signature = await signEip191("", privateKey);
    const isValid = await verifyEip191("", signature, address);
    
    if (!isValid) {
        failures += 1;
        console.error("  ❌ Failed to sign/verify empty message");
    } else {
        console.log("  ✅ Signed and verified empty message");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) failed`);
    process.exit(1);
}

console.log(`\n✅ All ${checks} EIP-191 signing tests passed`);
