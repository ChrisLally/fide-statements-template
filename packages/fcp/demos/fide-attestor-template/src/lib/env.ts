import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

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

export function loadDemoEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageRoot = join(here, "..", "..");
  const repoRoot = findRepoRoot(packageRoot);

  // Load shared monorepo env first.
  config({ path: join(repoRoot, ".env") });
  // Then allow package-local overrides.
  config({ path: join(packageRoot, ".env"), override: true });
}

