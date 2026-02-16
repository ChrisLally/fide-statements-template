export const isStatementBatchPath = (path: string): boolean => {
  return /^\.fide\/statements\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9]{64}\.jsonl$/.test(path);
};

export const rootFromStatementBatchPath = (path: string): string => {
  if (!isStatementBatchPath(path)) {
    throw new Error(`Invalid statement batch path: ${path}`);
  }

  return path.slice(path.lastIndexOf('/') + 1, -'.jsonl'.length);
};
