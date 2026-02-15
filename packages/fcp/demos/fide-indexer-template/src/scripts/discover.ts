/**
 * Discover GitHub repositories by topic for FCP registry indexing.
 *
 * Defaults:
 * - topic: fide-context-registry
 * - output: packages/fcp/demos/fide-indexer-template/.state/github-topic-repos.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

const TOPIC = process.env.FCP_REGISTRY_TOPIC ?? "fide-context-registry";
const GITHUB_API_BASE = process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const PER_PAGE = Math.min(Math.max(Number(process.env.FCP_DISCOVER_PER_PAGE ?? "100"), 1), 100);
const MAX_PAGES = Math.max(Number(process.env.FCP_DISCOVER_MAX_PAGES ?? "5"), 1);
const OUTPUT_PATH =
  process.env.FCP_DISCOVER_OUTPUT_PATH ??
  "packages/fcp/demos/fide-indexer-template/.state/github-topic-repos.json";

interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  topics?: string[];
  pushed_at: string;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function toAbsolutePath(pathLike: string): string {
  if (isAbsolute(pathLike)) return pathLike;
  return join(findRepoRoot(process.cwd()), pathLike);
}

async function searchTopicRepos(topic: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({
      q: `topic:${topic}`,
      sort: "updated",
      order: "desc",
      per_page: String(PER_PAGE),
      page: String(page),
    });

    const url = `${GITHUB_API_BASE}/search/repositories?${query.toString()}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub search failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as GitHubSearchResponse;
    repos.push(...data.items);

    if (data.items.length < PER_PAGE) break;
  }

  // Deduplicate by full_name in case paging overlaps under rapid updates.
  const seen = new Set<string>();
  return repos.filter((r) => {
    if (seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });
}

async function main() {
  console.log(`🔎 Discovering GitHub repos with topic: ${TOPIC}`);

  const repos = await searchTopicRepos(TOPIC);
  const outPath = toAbsolutePath(OUTPUT_PATH);
  await mkdir(dirname(outPath), { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    topic: TOPIC,
    count: repos.length,
    repos: repos.map((r) => ({
      fullName: r.full_name,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      defaultBranch: r.default_branch,
      private: r.private,
      pushedAt: r.pushed_at,
    })),
  };

  await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`✓ Found ${repos.length} repositories`);
  console.log(`✓ Saved: ${outPath}`);
  if (!GITHUB_TOKEN) {
    console.log("ℹ Tip: set GITHUB_TOKEN to avoid low anonymous API rate limits.");
  }
  if (repos.length > 0) {
    console.log("Top results:");
    for (const r of repos.slice(0, 5)) {
      console.log(`  - ${r.full_name}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Discover failed:", err);
  process.exit(1);
});
