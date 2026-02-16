export type IndexerSource = 'github-webhook';

export type SourceStatementBatchRef = {
  source: IndexerSource;
  repo: string;
  sha: string;
  path: string;
  root: string;
  sha256: string;
};

export type GithubStatementsWebhookItem = {
  path: string;
  root: string;
  sha256: string;
};

export type GithubStatementsWebhookPayload = {
  repo: string;
  repoId: string;
  ownerId: string;
  sha: string;
  runId: string;
  items: GithubStatementsWebhookItem[];
};
