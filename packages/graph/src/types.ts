import type { Statement } from '@fide.work/fcp';

export type StatementWire = {
  s: string;
  sr: string;
  p: string;
  pr: string;
  o: string;
  or: string;
};

export type ParsedStatementBatch = {
  statements: Statement[];
  statementWires: StatementWire[];
  statementFideIds: string[];
  root: string;
};

export type IngestJsonlBatchInput = {
  expectedRoot: string;
  jsonl: string;
  repoId: string;
  ownerId: string;
  githubRun: string;
  url: string;
};

export type IngestBatchResult = {
  insertedBatch: boolean;
  statementCount: number;
  root: string;
};
