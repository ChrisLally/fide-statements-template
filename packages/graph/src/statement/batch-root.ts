import { createHash } from 'node:crypto';

export function calculateStatementBatchRoot(statementFideIds: string[]): string {
  if (!Array.isArray(statementFideIds) || statementFideIds.length === 0) {
    throw new Error('Invalid statement batch: expected one or more statement Fide IDs.');
  }

  const canonicalIds = [...statementFideIds].sort();
  return createHash('sha256').update(canonicalIds.join('\n')).digest('hex');
}
