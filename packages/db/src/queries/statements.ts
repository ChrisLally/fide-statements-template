import { sql } from 'drizzle-orm';
import { assertFideId, parseFideId } from '@fide.work/fcp';
import { db } from '../client.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';

const PREDICATE_TYPE_CHAR = '6';
const PREDICATE_SOURCE_TYPE_CHAR = '5';

export type StatementItem = {
  statementFingerprint: string;
  subjectFideId: string;
  subjectRawIdentifier: string;
  // Legacy responses exposed only predicateRawIdentifier; predicateFideId is now canonical.
  predicateFideId: string;
  predicateRawIdentifier: string;
  objectFideId: string;
  objectRawIdentifier: string;
};

export type ListStatementsInput = {
  subjectFideId?: string;
  predicateFideId?: string;
  objectFideId?: string;
  limit?: number;
  cursor?: string;
};

function toFingerprintOrThrow(fideId: string, fieldName: string): string {
  try {
    assertFideId(fideId);
    return parseFideId(fideId).fingerprint;
  } catch {
    throw new Error(`Invalid ${fieldName}: expected did:fide:0x...`);
  }
}

export async function listStatements(input: ListStatementsInput): Promise<{ items: StatementItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const cursor = decodeCursor(input.cursor);

  const whereParts: Array<ReturnType<typeof sql>> = [
    sql`s.subject_source_type <> '0'`,
    sql`s.object_source_type <> '0'`,
  ];

  if (input.subjectFideId) {
    const fp = toFingerprintOrThrow(input.subjectFideId, 'subjectFideId');
    whereParts.push(sql`subject_fingerprint = ${fp}`);
  }

  if (input.objectFideId) {
    const fp = toFingerprintOrThrow(input.objectFideId, 'objectFideId');
    whereParts.push(sql`object_fingerprint = ${fp}`);
  }

  if (input.predicateFideId) {
    const fp = toFingerprintOrThrow(input.predicateFideId, 'predicateFideId');
    whereParts.push(sql`predicate_fingerprint = ${fp}`);
  }

  if (cursor) {
    whereParts.push(sql`statement_fingerprint > ${cursor.k}`);
  }

  const whereSql = whereParts.length > 0
    ? sql.join(whereParts, sql` and `)
    : sql`true`;

  const rawRows = await db.execute(sql<{
    statement_fingerprint: string;
    subject_fingerprint: string;
    subject_type: string;
    subject_source_type: string;
    subject_raw_identifier: string;
    predicate_fingerprint: string;
    predicate_raw_identifier: string;
    object_fingerprint: string;
    object_type: string;
    object_source_type: string;
    object_raw_identifier: string;
  }>`
    select
      s.statement_fingerprint,
      s.subject_fingerprint,
      s.subject_type,
      s.subject_source_type,
      subj_ident.raw_identifier as subject_raw_identifier,
      s.predicate_fingerprint,
      pred_ident.raw_identifier as predicate_raw_identifier,
      s.object_fingerprint,
      s.object_type,
      s.object_source_type,
      obj_ident.raw_identifier as object_raw_identifier
    from statements s
    inner join raw_identifiers subj_ident
      on subj_ident.identifier_fingerprint = s.subject_fingerprint
    inner join raw_identifiers pred_ident
      on pred_ident.identifier_fingerprint = s.predicate_fingerprint
    inner join raw_identifiers obj_ident
      on obj_ident.identifier_fingerprint = s.object_fingerprint
    where ${whereSql}
    order by s.statement_fingerprint asc
    limit ${limit + 1}
  `);
  const rows = rawRows as unknown as Array<{
    statement_fingerprint: string;
    subject_fingerprint: string;
    subject_type: string;
    subject_source_type: string;
    subject_raw_identifier: string;
    predicate_fingerprint: string;
    predicate_raw_identifier: string;
    object_fingerprint: string;
    object_type: string;
    object_source_type: string;
    object_raw_identifier: string;
  }>;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const items: StatementItem[] = pageRows.map((row) => ({
    statementFingerprint: row.statement_fingerprint,
    subjectFideId: `did:fide:0x${row.subject_type}${row.subject_source_type}${row.subject_fingerprint}`,
    subjectRawIdentifier: row.subject_raw_identifier,
    predicateFideId: `did:fide:0x${PREDICATE_TYPE_CHAR}${PREDICATE_SOURCE_TYPE_CHAR}${row.predicate_fingerprint}`,
    predicateRawIdentifier: row.predicate_raw_identifier,
    objectFideId: `did:fide:0x${row.object_type}${row.object_source_type}${row.object_fingerprint}`,
    objectRawIdentifier: row.object_raw_identifier,
  }));

  const nextCursor = hasMore && pageRows.length > 0
    ? encodeCursor({ k: pageRows[pageRows.length - 1]!.statement_fingerprint })
    : null;

  return { items, nextCursor };
}
