import { applyStatementBatch } from '@fide.work/graph';
import type { GithubStatementsWebhookPayload } from './types.js';
import { toSourceStatementBatchRefs } from './sources/github-webhook.js';
import { fetchStatementBatchJsonlFromGitHub } from './sources/github-content.js';

export type ProcessedBatchResult = {
  repo: string;
  sha: string;
  path: string;
  root: string;
  insertedBatch: boolean;
  statementCount: number;
};

export async function processGithubWebhookPayload(payload: GithubStatementsWebhookPayload): Promise<ProcessedBatchResult[]> {
  const refs = toSourceStatementBatchRefs(payload);
  const results: ProcessedBatchResult[] = [];

  for (const ref of refs) {
    const jsonl = await fetchStatementBatchJsonlFromGitHub(ref);
    const applied = await applyStatementBatch({
      expectedRoot: ref.root,
      jsonl,
      source: `github-webhook:${ref.repo}`,
    });

    results.push({
      repo: ref.repo,
      sha: ref.sha,
      path: ref.path,
      root: ref.root,
      insertedBatch: applied.insertedBatch,
      statementCount: applied.statementCount,
    });
  }

  return results;
}
