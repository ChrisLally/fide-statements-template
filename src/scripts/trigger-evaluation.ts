import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

async function main() {
  const token = process.env.FIDE_GH_PUSH_TOKEN;
  if (!token) {
    throw new Error("Missing FIDE_GH_PUSH_TOKEN in environment.");
  }

  const owner = process.env.FIDE_EVAL_REPO_OWNER ?? "ChrisLally";
  const repo = process.env.FIDE_EVAL_REPO_NAME ?? "fide-statements-template";
  const workflowId = process.env.FIDE_EVAL_WORKFLOW_ID ?? "evaluations.yml";
  const ref = process.env.FIDE_EVAL_REF ?? "main";

  const payload = {
    ref,
    inputs: {
      commit_results: process.env.FIDE_EVAL_COMMIT_RESULTS ?? "true",
      method_identifier:
        process.env.FIDE_SAMEAS_METHOD_IDENTIFIER ??
        "https://fide.work/methods/identity/sameas-trust/v1",
      input_identifier:
        process.env.FIDE_EVALUATION_INPUT_IDENTIFIER ??
        "https://fide.work/inputs/identity/sameas/current",
    },
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "fide-evaluation-trigger",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Dispatch failed (${response.status}): ${body}`);
  }

  console.log(`Triggered ${owner}/${repo} workflow ${workflowId} on ref ${ref}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

