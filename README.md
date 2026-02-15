# fide.work Turborepo

This repository contains applications and shared packages for `fide.work`, managed as a single Turborepo.

## Paths

- `apps/`
  - Application projects (for example `docs`, `api`).
- `packages/`
  - Shared packages and subtrees (including `packages/fcp` and `packages/db`).
- `_scratch/`
  - Temporary planning/brainstorming material.

Each area can include its own local `README.md` for package/app-specific commands.

## Current Baseline

- Starter sample apps/packages from the Turbo scaffold were removed.
- Shared infra packages are kept:
  - `packages/eslint-config`
  - `packages/typescript-config`
- Fide Context Protocol content is migrated under `packages/fcp`.

## Workspace Model

This repo uses a **single root workspace model**:

- One workspace root: this directory
- One lockfile: `/pnpm-lock.yaml`
- One Turbo config: `/turbo.json`
- Install and run commands from repo root

`packages/fcp` is treated as a normal workspace subtree, not an independent workspace root.
So `packages/fcp` does **not** keep its own `package.json` workspace root, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, or `turbo.json`.

## Run From Repo Root

```bash
pnpm install
pnpm build
pnpm check-types
```

## Current Status

Core slices (`apps/docs`, `apps/api`, `packages/fcp`, `packages/db`) are now integrated into this root Turborepo and validated via root workspace commands.

## Future Export Plan

For now, `fide.work-turbo` is the single source-of-truth Turborepo.

Later, `packages/fcp` may be exported/synced to a standalone public repository.
When that happens, we will add an automated export workflow (for example subtree split + standalone root config overlay) so the exported repo is independently runnable.
