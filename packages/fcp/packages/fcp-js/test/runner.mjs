#!/usr/bin/env node

/**
 * Test Runner for FCP SDK
 * 
 * Runs all tests organized by module folder structure.
 */

import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const testDir = resolve(here);
const verbose = process.argv.includes("--verbose");

// Test modules in order
const testModules = [
    "compliance.test.mjs", // Root level compliance tests
    "statement",
    "attestation",
    "broadcasting",
    "signing",
    "schema"
];

let totalFailures = 0;
let totalChecks = 0;
const moduleResults = [];

async function runTestFile(filePath) {
    return new Promise((resolve) => {
        const proc = spawn("node", [filePath], {
            stdio: verbose ? "inherit" : "pipe",
            cwd: testDir
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
            resolve({
                code,
                stdout,
                stderr,
                file: filePath
            });
        });
    });
}

async function runTestsInDir(dirPath, moduleName) {
    const files = await readdir(dirPath, { withFileTypes: true });
    const testFiles = files
        .filter((f) => f.isFile() && f.name.endsWith(".test.mjs"))
        .map((f) => join(dirPath, f.name));

    if (testFiles.length === 0) {
        return { passed: 0, failed: 0 };
    }

    let moduleFailures = 0;
    let moduleChecks = 0;

    for (const testFile of testFiles) {
        if (verbose) {
            console.log(`\n📁 Running ${moduleName}/${testFile.split("/").pop()}...`);
        }
        const result = await runTestFile(testFile);
        
        if (result.code !== 0) {
            moduleFailures++;
            if (!verbose) {
                console.error(`\n❌ ${moduleName}/${testFile.split("/").pop()} failed:`);
                console.error(result.stdout);
                console.error(result.stderr);
            }
        } else {
            if (!verbose) {
                // Extract check count from output if available
                const match = result.stdout.match(/(\d+) .* test.* passed/);
                if (match) {
                    moduleChecks += parseInt(match[1]);
                }
            }
        }
    }

    return { passed: moduleChecks, failed: moduleFailures };
}

async function main() {
    console.log("🧪 Running FCP SDK Tests\n");
    console.log("=" .repeat(50));

    for (const module of testModules) {
        const modulePath = resolve(testDir, module);
        
        try {
            if (module.endsWith(".test.mjs")) {
                // Root level test file
                if (verbose) {
                    console.log(`\n📁 Running ${module}...`);
                }
                const result = await runTestFile(modulePath);
                
                if (result.code !== 0) {
                    totalFailures++;
                    if (!verbose) {
                        console.error(`\n❌ ${module} failed:`);
                        console.error(result.stdout);
                        console.error(result.stderr);
                    }
                } else {
                    moduleResults.push({ module, status: "passed" });
                    if (!verbose) {
                        console.log(`✅ ${module}`);
                    }
                }
            } else {
                // Module directory
                const stats = await import("node:fs/promises").then(m => m.stat(modulePath).catch(() => null));
                
                if (stats && stats.isDirectory()) {
                    const result = await runTestsInDir(modulePath, module);
                    totalFailures += result.failed;
                    totalChecks += result.passed;
                    
                    if (result.failed === 0) {
                        moduleResults.push({ module, status: "passed", checks: result.passed });
                        if (!verbose) {
                            console.log(`✅ ${module} (${result.passed} checks)`);
                        }
                    } else {
                        moduleResults.push({ module, status: "failed", failures: result.failed });
                        if (!verbose) {
                            console.log(`❌ ${module} (${result.failed} failures)`);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.code === "ENOENT") {
                // Module doesn't exist, skip
                continue;
            }
            console.error(`Error running ${module}:`, error.message);
            totalFailures++;
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log("\n📊 Test Summary:\n");
    
    for (const result of moduleResults) {
        const icon = result.status === "passed" ? "✅" : "❌";
        const details = result.checks ? ` (${result.checks} checks)` : "";
        console.log(`${icon} ${result.module}${details}`);
    }

    if (totalFailures > 0) {
        console.error(`\n❌ ${totalFailures} test module(s) failed`);
        process.exit(1);
    }

    console.log(`\n✅ All tests passed!`);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
