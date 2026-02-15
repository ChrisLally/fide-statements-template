# First Exports Plan (2026-02-08)

## Goal

Ship a stable v0 of `@fide.work/fcp` with deterministic Fide ID generation and a compliance test contract.

## Done

- [x] Workspace + package scaffolding under `/fcp/packages/fcp`.
- [x] Exported `calculateFideId` (SHA-256, UTF-8, last-38-hex, returns `did:fide:0x...`).
- [x] Exported `calculateStatementFideId` (accepts 3 Fide IDs; supports `did:fide:...` and `0x...` inputs).
- [x] Exported `FIDE_ENTITY_TYPE_MAP`.
- [x] Organized code under `src/fide-id/`.
- [x] Added compliance vectors + runner (`test/vectors`, `test/compliance.test.mjs`).
- [x] Added `test:verbose` and `example` scripts.
- [x] Published initial npm package.

## Next 3

- [ ] Define SDK conventions doc (`packages/fcp/CONVENTIONS.md`) for naming, normalization boundaries, strict/permissive input policy, error model, and vector requirements.
- [ ] Add `src/statement/normalizeStatement`.
- [ ] Add vectors for statement helper edge cases (invalid IDs, uppercase/whitespace).
