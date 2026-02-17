import { sql } from 'drizzle-orm';
import { assertFideId, parseFideId } from '@fide.work/fcp';
import { db } from '../client.js';
import { listStatements, type StatementItem } from './statements.js';

export type EntityResult = {
  entityFideId: string;
  primaryRawIdentifier: string;
  aliases: string[];
  statements: StatementItem[];
  nextCursor: string | null;
};

export async function getEntityByFideId(input: {
  fideId: string;
  statementsLimit?: number;
  statementsCursor?: string;
}): Promise<EntityResult | null> {
  let fingerprint: string;
  try {
    assertFideId(input.fideId);
    fingerprint = parseFideId(input.fideId).fingerprint;
  } catch {
    throw new Error('Invalid fideId: expected did:fide:0x...');
  }

  const primaryRawRows = await db.execute(sql<{
    raw_identifier: string;
    entity_type: string;
    entity_source_type: string;
    entity_fingerprint: string;
  }>`
    select
      subj_ident.raw_identifier as raw_identifier,
      s.subject_type as entity_type,
      s.subject_source_type as entity_source_type,
      s.subject_fingerprint as entity_fingerprint
    from statements s
    inner join raw_identifiers subj_ident
      on subj_ident.identifier_fingerprint = s.subject_fingerprint
    where s.subject_fingerprint = ${fingerprint}
      and s.subject_source_type <> '0'
      and s.object_source_type <> '0'
    union all
    select
      obj_ident.raw_identifier as raw_identifier,
      s.object_type as entity_type,
      s.object_source_type as entity_source_type,
      s.object_fingerprint as entity_fingerprint
    from statements s
    inner join raw_identifiers obj_ident
      on obj_ident.identifier_fingerprint = s.object_fingerprint
    where s.object_fingerprint = ${fingerprint}
      and s.subject_source_type <> '0'
      and s.object_source_type <> '0'
    order by raw_identifier asc
    limit 1
  `);
  const primaryRows = primaryRawRows as unknown as Array<{
    raw_identifier: string;
    entity_type: string;
    entity_source_type: string;
    entity_fingerprint: string;
  }>;

  const primary = primaryRows[0];
  if (!primary) return null;

  const aliasRawRows = await db.execute(sql<{ raw_identifier: string }>`
    select distinct raw_identifier
    from (
      select subj_ident.raw_identifier as raw_identifier
      from statements s
      inner join raw_identifiers subj_ident
        on subj_ident.identifier_fingerprint = s.subject_fingerprint
      where s.subject_fingerprint = ${fingerprint}
        and s.subject_source_type <> '0'
        and s.object_source_type <> '0'
      union
      select obj_ident.raw_identifier as raw_identifier
      from statements s
      inner join raw_identifiers obj_ident
        on obj_ident.identifier_fingerprint = s.object_fingerprint
      where s.object_fingerprint = ${fingerprint}
        and s.subject_source_type <> '0'
        and s.object_source_type <> '0'
    ) aliases
    order by raw_identifier asc
    limit 200
  `);
  const aliasRows = aliasRawRows as unknown as Array<{ raw_identifier: string }>;

  const statementsPage = await listStatements({
    subjectFideId: `did:fide:0x${primary.entity_type}${primary.entity_source_type}${fingerprint}`,
    limit: input.statementsLimit ?? 25,
    cursor: input.statementsCursor,
  });

  return {
    entityFideId: `did:fide:0x${primary.entity_type}${primary.entity_source_type}${primary.entity_fingerprint}`,
    primaryRawIdentifier: primary.raw_identifier,
    aliases: aliasRows.map((row) => row.raw_identifier),
    statements: statementsPage.items,
    nextCursor: statementsPage.nextCursor,
  };
}
