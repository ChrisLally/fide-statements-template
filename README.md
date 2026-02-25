# Fide Statements Template

Template focused on statement publishing. This repo publishes `.fide/statements/**` and can optionally trigger external evaluation workflows.

## What this template does

- Keeps publish-ready statement batches in `.fide/statements/YYYY/MM/DD/{batchRoot}.jsonl`
- Keeps in-review drafts in `.fide/draft-statements/`
- Broadcasts batches from GitHub Actions
- Optionally dispatches evaluation workflows in another repository

## Folder Boundaries

- `.fide/statements/`: trusted/publish-ready statement batches.
- `.fide/draft-statements/`: draft/untrusted statement batches proposed by humans or agents.


## Local usage

From repo root:

```bash
pnpm demo:fide-statements-template:trigger:evaluation
```

## GitHub Action

Workflow file:

- `.github/workflows/statements-broadcast.yml`
- `.github/workflows/evaluation-run.yml`

Secrets:

- `FIDE_BROADCAST_URL` (optional; workflow falls back to `BROADCAST_URL_FALLBACK` when unset)
- `FIDE_BROADCAST_API_KEY` (optional if using OIDC Bearer auth)

Behavior:

- Triggered on pushes touching `.fide/statements/**`
- Broadcasts only newly added `*.jsonl` files in the push diff with `urlBase`, `metadata`, and `items[]` (`urlPath`, `root`, `sha256`)

## Evaluation Workflow (In-Repo)

- Workflow: `.github/workflows/evaluation-run.yml`
- Trigger: `workflow_dispatch` only (manual or API dispatch)
- Runs evaluation locally in this repo using installed methods from `.fide/evaluation-methods/index.json`
- Artifacts: `_scratch/evals/workflow/{input.json,input.jsonl,result.json,emitted.jsonl}`

Required secret:

- `DATABASE_URL` (used by `fide eval sameas-input`)

Method resolution:

- Uses `workflow_dispatch` input `method_id` when provided.
- Otherwise defaults to the first installed method in `.fide/evaluation-methods/index.json`.

## Evaluation Dispatch (API-only)

- `trigger:evaluation` now sends `repository_dispatch` to `ChrisLally/evaluation-methods`
- Event type: `evaluate_sameas_person_v1`
- Payload includes one `input` pointer (`urlBase`, `urlPath`, `root`)
- The input batch defaults to the latest local file in `.fide/statements/**`

### Local trigger helper

`trigger:evaluation` dispatches repository events through the GitHub API using `FIDE_GH_PUSH_TOKEN`.

CLI overrides:
- `--root <batchRoot>` picks a specific local batch by root
- `--url-path <repoRelativePath>` sets the exact repo-relative JSONL path
- both can be provided together to fully pin input

Required CLI flags:
- `--eval-owner <owner>`
- `--eval-repo <repo>`
- `--event-type <eventType>`
- `--method-id <methodId>`
- `--method-version <methodVersion>`
- `--source-owner <owner>`
- `--source-repo <repo>`
- `--source-ref <ref>`

Example:

```bash
pnpm trigger:evaluation \
  --eval-owner ChrisLally \
  --eval-repo evaluation-methods \
  --event-type evaluate_sameas_person_v1 \
  --method-id Fide-OwlSameAs-Person-v1 \
  --method-version v1 \
  --source-owner ChrisLally \
  --source-repo fide-statements-template \
  --source-ref main
```

## Optional Agentic Workflows

You can add agentic workflows for drafting/proposals, but keep them non-authoritative:

- Agentic workflows should write drafts under `.fide/draft-statements/`.
- Deterministic checks/workflows should validate and publish final statements.
- Do not let agentic runs write trusted statements directly without deterministic validation.
