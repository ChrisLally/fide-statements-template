#!/usr/bin/env node

import { resolve } from "node:path";

const exampleMap = {
  attestation: "examples/experimental/attestation/attestation-example.mjs",
  merkle: "examples/experimental/merkle/merkle-example.mjs",
  signing: "examples/experimental/signing/signing-example.mjs",
  "signing:eip712": "examples/experimental/signing/signing-eip712-example.mjs",
  "signing:eip191": "examples/experimental/signing/signing-eip191-example.mjs",
  broadcasting: "examples/experimental/broadcasting/broadcasting-example.mjs",
  "broadcasting:eip712": "examples/experimental/broadcasting/broadcasting-eip712-example.mjs"
};

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const target = args[0];

if (!target || !(target in exampleMap)) {
  console.error("Missing or invalid experimental target.");
  console.error("Usage: FCP_EXPERIMENTAL=1 pnpm run example:experimental -- <target>");
  console.error("Targets:");
  for (const key of Object.keys(exampleMap)) {
    console.error(`  - ${key}`);
  }
  process.exit(1);
}

const scriptPath = resolve(process.cwd(), exampleMap[target]);
await import(`file://${scriptPath}`);
