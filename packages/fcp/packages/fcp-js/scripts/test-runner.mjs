#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const verbose = process.argv.includes("--verbose");

const testFiles = [
    "src/fide-id/compliance.test.mjs",
    "src/statement/build.test.mjs",
    "src/experimental/attestation/verify.test.mjs",
    "src/experimental/broadcasting/registry.test.mjs",
    "src/experimental/signing/eip191.test.mjs"
];

async function runTestFile(relativePath) {
    const filePath = resolve(packageRoot, relativePath);
    return new Promise((resolveResult) => {
        const proc = spawn("node", [filePath], {
            stdio: verbose ? "inherit" : "pipe",
            cwd: packageRoot
        });

        let stdout = "";
        let stderr = "";

        if (!verbose) {
            proc.stdout.on("data", (data) => {
                stdout += data.toString();
            });
            proc.stderr.on("data", (data) => {
                stderr += data.toString();
            });
        }

        proc.on("close", (code) => {
            resolveResult({ code, stdout, stderr, file: relativePath });
        });
    });
}

async function main() {
    console.log("🧪 Running FCP SDK Tests\n");
    console.log("=".repeat(50));

    let failures = 0;

    for (const file of testFiles) {
        if (verbose) {
            console.log(`\n📁 Running ${file}...`);
        }
        const result = await runTestFile(file);
        if (result.code !== 0) {
            failures += 1;
            if (!verbose) {
                console.error(`\n❌ ${file} failed:`);
                console.error(result.stdout);
                console.error(result.stderr);
            }
        } else if (!verbose) {
            console.log(`✅ ${file}`);
        }
    }

    console.log("\n" + "=".repeat(50));

    if (failures > 0) {
        console.error(`\n❌ ${failures} test file(s) failed`);
        process.exit(1);
    }

    console.log("\n✅ All tests passed!");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
