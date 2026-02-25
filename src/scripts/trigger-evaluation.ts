import { loadDemoEnv } from "../lib/env.js";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

loadDemoEnv();

const TEMPLATE_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const STATEMENTS_ROOT = process.env.FCP_STATEMENTS_PATH ?? join(TEMPLATE_ROOT, ".fide", "statements");

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function getRequiredArg(flag: string): string {
  const value = getArg(flag);
  if (!value) {
    throw new Error(`Missing required flag: ${flag}`);
  }
  return value;
}

async function listJsonlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function findLatestStatementBatch(): Promise<{ root: string; urlPath: string }> {
  const files = await listJsonlFiles(STATEMENTS_ROOT);
  if (files.length === 0) {
    throw new Error(`No statement batch files found under ${STATEMENTS_ROOT}`);
  }

  files.sort((a, b) => a.localeCompare(b));
  const latest = files[files.length - 1]!;
  const root = latest.split("/").pop()!.replace(/\.jsonl$/, "");
  const relativePath = relative(TEMPLATE_ROOT, latest).split(sep).join("/");

  return { root, urlPath: relativePath };
}

async function resolveInputBatch(): Promise<{ root: string; urlPath: string }> {
  const rootArg = getArg("--root");
  const pathArg = getArg("--url-path");

  if (rootArg && pathArg) {
    return { root: rootArg, urlPath: pathArg };
  }

  if (rootArg) {
    const files = await listJsonlFiles(STATEMENTS_ROOT);
    const match = files
      .map((fullPath) => relative(TEMPLATE_ROOT, fullPath).split(sep).join("/"))
      .find((urlPath) => urlPath.endsWith(`/${rootArg}.jsonl`) || urlPath.endsWith(`${rootArg}.jsonl`));
    if (!match) {
      throw new Error(`Could not find local batch for --root ${rootArg}`);
    }
    return { root: rootArg, urlPath: match };
  }

  if (pathArg) {
    const fileName = pathArg.split("/").pop() ?? "";
    const root = fileName.replace(/\.jsonl$/, "");
    if (!root || root === fileName) {
      throw new Error("Invalid --url-path: expected path ending in <root>.jsonl");
    }
    return { root, urlPath: pathArg };
  }

  return findLatestStatementBatch();
}

async function main() {
  const token = process.env.FIDE_GH_PUSH_TOKEN;
  if (!token) {
    throw new Error("Missing FIDE_GH_PUSH_TOKEN in environment.");
  }

  const owner = getRequiredArg("--eval-owner");
  const repo = getRequiredArg("--eval-repo");
  const eventType = getRequiredArg("--event-type");
  const methodId = getRequiredArg("--method-id");
  const methodVersion = getRequiredArg("--method-version");
  const sourceOwner = getRequiredArg("--source-owner");
  const sourceRepo = getRequiredArg("--source-repo");
  const sourceRef = getRequiredArg("--source-ref");

  const { root, urlPath } = await resolveInputBatch();
  const urlBase = `https://raw.githubusercontent.com/${sourceOwner}/${sourceRepo}/${sourceRef}`;

  const payload = {
    event_type: eventType,
    client_payload: {
      methodId,
      methodVersion,
      input: {
        urlBase,
        urlPath,
        root,
      },
    },
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "fide-evaluation-trigger",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Dispatch failed (${response.status}): ${body}`);
  }

  console.log(`Triggered ${owner}/${repo} repository_dispatch (${eventType}).`);
  console.log(`Input root: ${root}`);
  console.log(`Input pointer: ${urlBase}/${urlPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
