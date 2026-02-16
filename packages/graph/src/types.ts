export type GraphScope = 'global' | 'workspace';

export type StatementBatchRef = {
  repo: string;
  sha: string;
  path: string;
  root: string;
  sha256: string;
};
