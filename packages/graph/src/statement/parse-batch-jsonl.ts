import { assertFideId, calculateStatementFideId, type FideId, type Statement } from '@fide.work/fcp';
import type { ParsedStatementBatch, StatementWire } from '../types.js';
import { calculateStatementBatchRoot } from './batch-root.js';

function assertString(value: unknown, field: string, lineNumber: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid statement line ${lineNumber}: expected non-empty string at ${field}`);
  }
  return value;
}

function parseLineToWire(line: string, lineNumber: number): StatementWire {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`Invalid statement line ${lineNumber}: invalid JSON`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid statement line ${lineNumber}: expected object`);
  }

  const obj = parsed as Record<string, unknown>;
  return {
    s: assertString(obj.s, 's', lineNumber),
    sr: assertString(obj.sr, 'sr', lineNumber),
    p: assertString(obj.p, 'p', lineNumber),
    pr: assertString(obj.pr, 'pr', lineNumber),
    o: assertString(obj.o, 'o', lineNumber),
    or: assertString(obj.or, 'or', lineNumber),
  };
}

async function wireToStatement(wire: StatementWire): Promise<Statement> {
  assertFideId(wire.s);
  assertFideId(wire.p);
  assertFideId(wire.o);

  const subjectFideId = wire.s as FideId;
  const predicateFideId = wire.p as FideId;
  const objectFideId = wire.o as FideId;
  const statementFideId = await calculateStatementFideId(subjectFideId, predicateFideId, objectFideId);

  return {
    subjectFideId,
    subjectRawIdentifier: wire.sr,
    predicateFideId,
    predicateRawIdentifier: wire.pr,
    objectFideId,
    objectRawIdentifier: wire.or,
    statementFideId,
  };
}

export async function parseStatementBatchJsonl(input: string): Promise<ParsedStatementBatch> {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Invalid statement batch: expected non-empty JSONL string');
  }

  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error('Invalid statement batch: no statement lines found');
  }

  const statementWires = lines.map((line, index) => parseLineToWire(line, index + 1));
  const statements = await Promise.all(statementWires.map((wire) => wireToStatement(wire)));

  const statementFideIds = statements.map((statement, index) => {
    if (!statement.statementFideId) {
      throw new Error(`Invalid statement line ${index + 1}: missing computed statementFideId`);
    }
    return statement.statementFideId;
  });

  const root = calculateStatementBatchRoot(statementFideIds);
  return { statements, statementWires, statementFideIds, root };
}
