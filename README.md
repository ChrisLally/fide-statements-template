# Fide Statements Template

Template focused on publishing trusted statement batches.

## What this template does

- Keeps publish-ready statement batches in `.fide/statements/YYYY/MM/DD/{batchRoot}.jsonl`
- Keeps in-review drafts in `.fide/draft-statements/`
- Broadcasts batches from GitHub Actions

## Folder Boundaries

- `.fide/statements/`: trusted/publish-ready statement batches.
- `.fide/draft-statements/`: draft/untrusted statement batches proposed by humans or agents.

## GitHub Action

Workflow file:

- `.github/workflows/statements-broadcast.yml`

Secrets:

- `FIDE_BROADCAST_URL` (optional; workflow falls back to `BROADCAST_URL_FALLBACK` when unset)
- `FIDE_BROADCAST_API_KEY` (optional if using OIDC Bearer auth)

Behavior:

- Triggered on pushes touching `.fide/statements/**`
- Broadcasts only newly added `*.jsonl` files in the push diff with `urlBase`, `metadata`, and `items[]` (`urlPath`, `root`, `sha256`)

## Optional Agentic Workflows

You can add agentic workflows for drafting/proposals, but keep them non-authoritative:

- Agentic workflows should write drafts under `.fide/draft-statements/`.
- Deterministic checks/workflows should validate and publish final statements.
- Do not let agentic runs write trusted statements directly without deterministic validation.
