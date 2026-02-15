// This example shows what happens when you try to use EIP-712 functions
// without having viem installed

console.log("Testing EIP-712 without viem installed...\n");

try {
    // This will fail with a helpful error message if viem is not installed
    const { signEip712 } = await import("../../dist/index.js");
    await signEip712("0x1234", "0x".padEnd(66, "1"));
    console.log("✅ viem is installed, EIP-712 functions work!");
} catch (error) {
    console.log("❌ Error caught:");
    console.log(error.message);
    console.log("\n✅ The error message is helpful and tells you how to fix it!");
}
