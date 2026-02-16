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
      subject_raw_identifier as raw_identifier,
      subject_type as entity_type,
      subject_source_type as entity_source_type,
      subject_fingerprint as entity_fingerprint
    from fcp_statements_identifiers_resolved
    where subject_fingerprint = ${fingerprint}
      and subject_source_type_original <> '0'
      and object_source_type_original <> '0'
    union all
    select
      object_raw_identifier as raw_identifier,
      object_type as entity_type,
      object_source_type as entity_source_type,
      object_fingerprint as entity_fingerprint
    from fcp_statements_identifiers_resolved
    where object_fingerprint = ${fingerprint}
      and subject_source_type_original <> '0'
      and object_source_type_original <> '0'
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
      select subject_raw_identifier as raw_identifier
      from fcp_statements_identifiers_resolved
      where subject_fingerprint = ${fingerprint}
        and subject_source_type_original <> '0'
        and object_source_type_original <> '0'
      union
      select object_raw_identifier as raw_identifier
      from fcp_statements_identifiers_resolved
      where object_fingerprint = ${fingerprint}
        and subject_source_type_original <> '0'
        and object_source_type_original <> '0'
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
