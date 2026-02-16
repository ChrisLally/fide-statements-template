# Fide Statements Template

Minimal Fide Context Protocol template for publishing statement batches only.

## What this template does

- Writes statement batches to `.fide/statements/YYYY/MM/DD/{batchHash}.jsonl`
- Notifies a webhook from GitHub Actions when new statement files are added

## Local usage

From repo root:

```bash
pnpm demo:fide-statements-template:seed
```

## GitHub Action

Workflow file:

- `.github/workflows/statements-webhook.yml`

Required secret:

- `FIDE_WEBHOOK_URL`

Behavior:

- Triggers on pushes touching `.fide/statements/**`
- Processes only newly added `*.jsonl` files
- Fails if statement files are modified/deleted/renamed
- Sends `repo`, `sha`, `runId`, and `items[]` (`path`, `root`, `sha256`) to webhook
