import { boolean, char, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const fcpRawIdentifiers = pgTable('fcp_raw_identifiers', {
  identifierFingerprint: char('identifier_fingerprint', { length: 38 }).primaryKey(),
  rawIdentifier: text('raw_identifier').notNull(),
}, (table) => ({
  rawIdentifierIdx: index('idx_raw_identifiers_raw').on(table.rawIdentifier),
}));

export const fcpStatements = pgTable('fcp_statements', {
  statementFingerprint: char('statement_fingerprint', { length: 38 }).primaryKey(),
  firstCreatedAt: timestamp('first_created_at', { withTimezone: true }).notNull().defaultNow(),
  subjectType: char('subject_type', { length: 1 }).notNull(),
  subjectSourceType: char('subject_source_type', { length: 1 }).notNull(),
  subjectFingerprint: char('subject_fingerprint', { length: 38 }).notNull(),
  predicateFingerprint: char('predicate_fingerprint', { length: 38 }).notNull(),
  predicateType: char('predicate_type', { length: 1 }).notNull(),
  predicateSourceType: char('predicate_source_type', { length: 1 }).notNull(),
  objectType: char('object_type', { length: 1 }).notNull(),
  objectSourceType: char('object_source_type', { length: 1 }).notNull(),
  objectFingerprint: char('object_fingerprint', { length: 38 }).notNull(),
});

export const fcpStatementBatches = pgTable('fcp_statement_batches', {
  root: char('root', { length: 64 }).primaryKey(),
  repoId: text('repo_id').notNull(),
  ownerId: text('owner_id').notNull(),
  githubRun: text('github_run').notNull(),
  url: text('url').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fcpStatementBatchItems = pgTable('fcp_statement_batch_items', {
  batchRoot: char('batch_root', { length: 64 })
    .notNull()
    .references(() => fcpStatementBatches.root, { onDelete: 'cascade' }),
  statementFingerprint: char('statement_fingerprint', { length: 38 })
    .notNull()
    .references(() => fcpStatements.statementFingerprint, { onDelete: 'cascade' }),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  batchStmtUniqueIdx: uniqueIndex('idx_fcp_statement_batch_items_unique').on(
    table.batchRoot,
    table.statementFingerprint
  ),
}));

export const fideApiKeys = pgTable('fide_api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  truncatedKey: text('truncated_key').notNull(),
  scopes: text('scopes').array().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenHashUniqueIdx: index('idx_fide_api_keys_token_hash').on(table.tokenHash),
  activeIdx: index('idx_fide_api_keys_active').on(table.isActive),
}));

export type FideApiKey = typeof fideApiKeys.$inferSelect;

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  keyHash: text('key_hash').notNull(),
  userId: text('user_id'),
  createdByUserId: text('created_by_user_id'),
  scopes: text('scopes').array(),
  isActive: boolean('is_active').notNull().default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyHashUniqueIdx: index('idx_api_keys_key_hash').on(table.keyHash),
  activeIdx: index('idx_api_keys_is_active').on(table.isActive),
  expiresAtIdx: index('idx_api_keys_expires_at').on(table.expiresAt),
  userIdIdx: index('idx_api_keys_user_id').on(table.userId),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
