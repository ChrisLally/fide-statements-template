import { ingestStatementBatch } from '@fide.work/db';
import type { IngestBatchResult, IngestJsonlBatchInput } from '../types.js';
import { parseStatementBatchJsonl } from '../statement/parse-batch-jsonl.js';

export async function applyStatementBatch(input: IngestJsonlBatchInput): Promise<IngestBatchResult> {
  const parsed = await parseStatementBatchJsonl(input.jsonl);

  if (parsed.root !== input.expectedRoot) {
    throw new Error(
      `Statement batch root mismatch: expected ${input.expectedRoot}, computed ${parsed.root}`
    );
  }

  const result = await ingestStatementBatch({
    root: parsed.root,
    source: input.source ?? 'unknown',
    statements: parsed.statements,
  });

  return {
    insertedBatch: result.insertedBatch,
    statementCount: result.statementCount,
    root: parsed.root,
  };
}
