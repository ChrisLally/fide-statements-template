# Fide Statements Template

Minimal Fide Context Protocol template for publishing statement batches only.

## What this template does

- Writes statement batches to `.fide/statements/YYYY/MM/DD/{batchHash}.jsonl`
- Notifies a webhook from GitHub Actions when new statement files are added

## Local usage

From repo root:

```bash
pnpm demo:fide-statements-template:seed
pnpm demo:fide-statements-template:evaluate:sameas
```

## GitHub Action

Workflow file:

- `.github/workflows/statements-webhook.yml`
- `.github/workflows/evaluations.yml`

Required secret:

- `FIDE_WEBHOOK_URL`
- `FIDE_GH_PUSH_TOKEN` (for evaluations workflow commit/push step)

Behavior:

- Triggers on pushes touching `.fide/statements/**`
- Processes only newly added `*.jsonl` files
- Fails if statement files are modified/deleted/renamed
- Sends `repo`, `sha`, `runId`, and `items[]` (`path`, `root`, `sha256`) to webhook

## Evaluations workflow (API-only trigger)

- `evaluations.yml` is `workflow_dispatch` only
- Runs `evaluate:sameas` to emit evaluation event + citation statements into `.fide/statements/**`
- Optionally commits and pushes generated files (default: on)
- The push then triggers `statements-webhook.yml`
