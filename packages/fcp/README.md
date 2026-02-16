# Fide Context Protocol Repo

This directory is the standalone Fide Context Protocol (FCP) Turborepo root.

## Quick Start

From the repository root:

```bash
pnpm install
pnpm dev
```

Common root commands:

- `pnpm build` - run builds across workspaces
- `pnpm check-types` - run type checks across workspaces
- `pnpm lint` - run lint tasks across workspaces

## Workspace Layout

- `apps/*` - protocol apps (for example docs/site)
- `packages/*` - publishable packages and shared configs

## JS SDK Package

The official JS SDK lives at:

- `/packages/fcp-js`

Package name:

- `@fide.work/fcp`

Run SDK commands:

```bash
pnpm --filter @fide.work/fcp build
pnpm --filter @fide.work/fcp test
pnpm --filter @fide.work/fcp example
```

`fcp-js` is self-contained with:

- `src/` - SDK source
- `src/**/*.test.mjs` - SDK tests (co-located with source modules)
- `scripts/test-runner.mjs` - SDK test runner
- `examples/` - runnable SDK examples
