import { eq, sql } from 'drizzle-orm';
import { assertFideId, parseFideId, type Statement } from '@fide.work/fcp';
import { db } from '../client.js';
import {
  fcpRawIdentifiers,
  fcpStatementBatchItems,
  fcpStatementBatches,
  fcpStatements,
} from '../schema.js';

export type RawIdentifierUpsertRow = {
  identifierFingerprint: string;
  rawIdentifier: string;
};

export type StatementUpsertRow = {
  statementFingerprint: string;
  subjectType: string;
  subjectSourceType: string;
  subjectFingerprint: string;
  predicateFingerprint: string;
  predicateType: string;
  predicateSourceType: string;
  objectType: string;
  objectSourceType: string;
  objectFingerprint: string;
};

function assertStatementHasId(statement: Statement): asserts statement is Statement & { statementFideId: string } {
  if (!statement.statementFideId) {
    throw new Error('Invalid statement: missing statementFideId.');
  }
}

export function normalizeStatementsForIngest(statements: Statement[]): {
  rawIdentifiers: RawIdentifierUpsertRow[];
  statementRows: StatementUpsertRow[];
} {
  const rawByFingerprint = new Map<string, string>();
  const statementByFingerprint = new Map<string, StatementUpsertRow>();

  for (const statement of statements) {
    assertStatementHasId(statement);

    assertFideId(statement.subjectFideId);
    assertFideId(statement.predicateFideId);
    assertFideId(statement.objectFideId);
    assertFideId(statement.statementFideId);

    const subject = parseFideId(statement.subjectFideId);
    const predicate = parseFideId(statement.predicateFideId);
    const object = parseFideId(statement.objectFideId);
    const statementId = parseFideId(statement.statementFideId);

    rawByFingerprint.set(subject.fingerprint, statement.subjectRawIdentifier);
    rawByFingerprint.set(predicate.fingerprint, statement.predicateRawIdentifier);
    rawByFingerprint.set(object.fingerprint, statement.objectRawIdentifier);

    statementByFingerprint.set(statementId.fingerprint, {
      statementFingerprint: statementId.fingerprint,
      subjectType: subject.typeChar,
      subjectSourceType: subject.sourceChar,
      subjectFingerprint: subject.fingerprint,
      predicateFingerprint: predicate.fingerprint,
      predicateType: predicate.typeChar,
      predicateSourceType: predicate.sourceChar,
      objectType: object.typeChar,
      objectSourceType: object.sourceChar,
      objectFingerprint: object.fingerprint,
    });
  }

  const rawIdentifiers: RawIdentifierUpsertRow[] = Array.from(rawByFingerprint.entries()).map(([identifierFingerprint, rawIdentifier]) => ({
    identifierFingerprint,
    rawIdentifier,
  }));

  const statementRows = Array.from(statementByFingerprint.values());

  return { rawIdentifiers, statementRows };
}

export async function hasStatementBatchRoot(root: string): Promise<boolean> {
  const rows = await db
    .select({ root: fcpStatementBatches.root })
    .from(fcpStatementBatches)
    .where(eq(fcpStatementBatches.root, root))
    .limit(1);

  return rows.length > 0;
}

export async function insertStatementBatchRoot(root: string, source: string = 'unknown'): Promise<void> {
  await db
    .insert(fcpStatementBatches)
    .values({ root, source })
    .onConflictDoNothing({ target: fcpStatementBatches.root });
}

export async function upsertRawIdentifiers(rows: RawIdentifierUpsertRow[]): Promise<void> {
  if (rows.length === 0) return;

  await db
    .insert(fcpRawIdentifiers)
    .values(rows)
    .onConflictDoUpdate({
      target: fcpRawIdentifiers.identifierFingerprint,
      set: {
        rawIdentifier: sql`excluded.raw_identifier`,
      },
    });
}

export async function upsertStatements(rows: StatementUpsertRow[]): Promise<void> {
  if (rows.length === 0) return;

  await db
    .insert(fcpStatements)
    .values(rows)
    .onConflictDoNothing({ target: fcpStatements.statementFingerprint });
}

export async function linkStatementsToBatch(batchRoot: string, statementFingerprints: string[]): Promise<void> {
  if (statementFingerprints.length === 0) return;

  await db
    .insert(fcpStatementBatchItems)
    .values(statementFingerprints.map((statementFingerprint) => ({
      batchRoot,
      statementFingerprint,
    })))
    .onConflictDoNothing({
      target: [fcpStatementBatchItems.batchRoot, fcpStatementBatchItems.statementFingerprint],
    });
}

export async function listBatchStatementFingerprints(batchRoot: string): Promise<string[]> {
  const rows = await db
    .select({ statementFingerprint: fcpStatementBatchItems.statementFingerprint })
    .from(fcpStatementBatchItems)
    .where(eq(fcpStatementBatchItems.batchRoot, batchRoot));

  return rows.map((row) => row.statementFingerprint);
}

export async function ingestStatementBatch(input: {
  root: string;
  source?: string;
  statements: Statement[];
}): Promise<{ insertedBatch: boolean; statementCount: number }> {
  const exists = await hasStatementBatchRoot(input.root);
  if (exists) {
    return { insertedBatch: false, statementCount: 0 };
  }

  const { rawIdentifiers, statementRows } = normalizeStatementsForIngest(input.statements);
  const statementFingerprints = statementRows.map((row) => row.statementFingerprint);

  await insertStatementBatchRoot(input.root, input.source ?? 'unknown');
  await upsertRawIdentifiers(rawIdentifiers);
  await upsertStatements(statementRows);
  await linkStatementsToBatch(input.root, statementFingerprints);

  return { insertedBatch: true, statementCount: statementFingerprints.length };
}
