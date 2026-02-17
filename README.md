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
pnpm demo:fide-statements-template:trigger:evaluation
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

### Local trigger helper

`trigger:evaluation` dispatches `evaluations.yml` through the GitHub API using `FIDE_GH_PUSH_TOKEN`.

Optional local env overrides:
- `FIDE_EVAL_REPO_OWNER` (default: `ChrisLally`)
- `FIDE_EVAL_REPO_NAME` (default: `fide-statements-template`)
- `FIDE_EVAL_WORKFLOW_ID` (default: `evaluations.yml`)
- `FIDE_EVAL_REF` (default: `main`)
- `FIDE_EVAL_COMMIT_RESULTS` (default: `true`)
