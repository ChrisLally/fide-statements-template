import { sql } from 'drizzle-orm';
import { db } from '../client.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';

export type SearchGraphInput = {
  q: string;
  type?: string;
  limit?: number;
  cursor?: string;
};

export type SearchGraphItem = {
  fideId: string;
  rawIdentifier: string;
  type: string;
  sourceType: string;
};

export async function searchGraph(input: SearchGraphInput): Promise<{
  items: SearchGraphItem[];
  nextCursor: string | null;
}> {
  const q = input.q.trim();
  if (!q) {
    throw new Error('q is required');
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const cursor = decodeCursor(input.cursor);

  const typeFilterSql = input.type
    ? sql`and entity_type = ${input.type}`
    : sql``;

  const cursorSql = cursor
    ? sql`and entity_fingerprint > ${cursor.k}`
    : sql``;

  const rawRows = await db.execute(sql<{
    entity_type: string;
    entity_source_type: string;
    entity_fingerprint: string;
    raw_identifier: string;
  }>`
    with entities as (
      select
        s.subject_type as entity_type,
        s.subject_source_type as entity_source_type,
        s.subject_fingerprint as entity_fingerprint,
        subj_ident.raw_identifier as raw_identifier
      from statements s
      inner join raw_identifiers subj_ident
        on subj_ident.identifier_fingerprint = s.subject_fingerprint
      where s.subject_source_type <> '0'
        and s.object_source_type <> '0'
      union
      select
        s.object_type as entity_type,
        s.object_source_type as entity_source_type,
        s.object_fingerprint as entity_fingerprint,
        obj_ident.raw_identifier as raw_identifier
      from statements s
      inner join raw_identifiers obj_ident
        on obj_ident.identifier_fingerprint = s.object_fingerprint
      where s.subject_source_type <> '0'
        and s.object_source_type <> '0'
    )
    select distinct on (entity_fingerprint)
      entity_type,
      entity_source_type,
      entity_fingerprint,
      raw_identifier
    from entities
    where raw_identifier ilike ${`%${q}%`}
      ${typeFilterSql}
      ${cursorSql}
    order by entity_fingerprint asc, raw_identifier asc
    limit ${limit + 1}
  `);
  const rows = rawRows as unknown as Array<{
    entity_type: string;
    entity_source_type: string;
    entity_fingerprint: string;
    raw_identifier: string;
  }>;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const items = pageRows.map((row) => ({
    fideId: `did:fide:0x${row.entity_type}${row.entity_source_type}${row.entity_fingerprint}`,
    rawIdentifier: row.raw_identifier,
    type: row.entity_type,
    sourceType: row.entity_source_type,
  }));

  const nextCursor = hasMore && pageRows.length > 0
    ? encodeCursor({ k: pageRows[pageRows.length - 1]!.entity_fingerprint })
    : null;

  return { items, nextCursor };
}
