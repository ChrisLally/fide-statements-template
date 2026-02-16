import type { GithubStatementsWebhookPayload, SourceStatementBatchRef } from '../types.js';
import { isStatementBatchPath, rootFromStatementBatchPath } from '../utils/statement-batch-path.js';

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid webhook payload: expected non-empty string at ${field}`);
  }
  return value;
}

export const parseGithubStatementsWebhookPayload = (input: unknown): GithubStatementsWebhookPayload => {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid webhook payload: expected object');
  }

  const payload = input as Record<string, unknown>;
  const repo = assertNonEmptyString(payload.repo, 'repo');
  const sha = assertNonEmptyString(payload.sha, 'sha');
  const runId = assertNonEmptyString(payload.runId, 'runId');

  if (!Array.isArray(payload.items)) {
    throw new Error('Invalid webhook payload: expected items array');
  }

  const items = payload.items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid webhook payload: expected object at items[${index}]`);
    }

    const value = item as Record<string, unknown>;
    const path = assertNonEmptyString(value.path, `items[${index}].path`);
    const root = assertNonEmptyString(value.root, `items[${index}].root`);
    const sha256 = assertNonEmptyString(value.sha256, `items[${index}].sha256`);

    if (!isStatementBatchPath(path)) {
      throw new Error(`Invalid statement batch path at items[${index}].path: ${path}`);
    }

    const pathRoot = rootFromStatementBatchPath(path);
    if (pathRoot !== root) {
      throw new Error(
        `Invalid webhook payload: root/path mismatch at items[${index}] (root=${root}, pathRoot=${pathRoot})`
      );
    }

    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`Invalid webhook payload: expected sha256 hex at items[${index}].sha256`);
    }

    return { path, root, sha256 };
  });

  return { repo, sha, runId, items };
};

export const toSourceStatementBatchRefs = (
  payload: GithubStatementsWebhookPayload
): SourceStatementBatchRef[] => {
  return payload.items.map((item) => ({
    source: 'github-webhook',
    repo: payload.repo,
    sha: payload.sha,
    path: item.path,
    root: item.root,
    sha256: item.sha256,
  }));
};
