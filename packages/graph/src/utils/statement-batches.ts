import type { StatementBatchRef } from '../types.js';

export const isStatementBatchPath = (path: string): boolean => {
  return /^\.fide\/statements\/\d{4}\/\d{2}\/\d{2}\/.+\.jsonl$/.test(path);
};

export const uniqueBatchKey = (batch: StatementBatchRef): string => {
  return `${batch.repo}:${batch.sha}:${batch.path}`;
};
