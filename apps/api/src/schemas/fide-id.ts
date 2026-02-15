import { z } from '@hono/zod-openapi';
import { FIDE_ENTITY_TYPE_MAP } from '@fide.work/fcp';

const ENTITY_TYPES = Object.keys(FIDE_ENTITY_TYPE_MAP) as [
  keyof typeof FIDE_ENTITY_TYPE_MAP,
  ...(keyof typeof FIDE_ENTITY_TYPE_MAP)[],
];

export const FideIdCalculateRequestSchema = z
  .object({
    entityType: z.enum(ENTITY_TYPES).openapi({
      example: 'Person',
      description: 'Entity type for the resulting identifier.',
    }),
    sourceType: z.enum(ENTITY_TYPES).openapi({
      example: 'Product',
      description: 'Source type for the resulting identifier.',
    }),
    rawIdentifier: z.string().min(1).openapi({
      example: 'https://x.com/alice',
      description: 'Raw identifier input used to derive the Fide ID.',
    }),
  })
  .openapi('FideIdCalculateRequest');

export const FideIdCalculateResponseSchema = z
  .object({
    fideId: z.string().openapi({
      example: 'did:fide:0x15a1b2c3d4e5f6789012345678901234567890ab',
      description: 'Calculated full Fide ID.',
    }),
  })
  .openapi('FideIdCalculateResponse');

export const FideIdParseRequestSchema = z
  .object({
    fideId: z.string().openapi({
      example: 'did:fide:0x15a1b2c3d4e5f6789012345678901234567890ab',
      description: 'Full Fide ID to parse.',
    }),
  })
  .openapi('FideIdParseRequest');

export const FideIdParseResponseSchema = z
  .object({
    fideId: z.string().describe('Original full Fide ID input.'),
    entityType: z.string().describe('Decoded entity type from type char.'),
    sourceType: z.string().describe('Decoded source type from source char.'),
    fingerprint: z.string().describe('38-character fingerprint suffix.'),
    typeChar: z.string().describe('Single-character encoded entity type.'),
    sourceChar: z.string().describe('Single-character encoded source type.'),
  })
  .openapi('FideIdParseResponse');

export const FideIdStatementRequestSchema = z
  .object({
    subjectFideId: z.string().openapi({
      example: 'did:fide:0x1512345678901234567890123456789012345678',
      description: 'Subject Fide ID.',
    }),
    predicateFideId: z.string().openapi({
      example: 'did:fide:0x6512345678901234567890123456789012345678',
      description: 'Predicate Fide ID (must be 0x65 or 0xe5 typed).',
    }),
    objectFideId: z.string().openapi({
      example: 'did:fide:0x6512345678901234567890123456789012345678',
      description: 'Object Fide ID.',
    }),
  })
  .openapi('FideIdStatementRequest');

export const FideIdStatementResponseSchema = z
  .object({
    statementFideId: z.string().openapi({
      example: 'did:fide:0x0012345678901234567890123456789012345678',
      description: 'Calculated statement Fide ID.',
    }),
  })
  .openapi('FideIdStatementResponse');

export const FideIdCalculateErrorCodeSchema = z.enum([
  'INVALID_ENTITY_TYPE',
  'INVALID_SOURCE_TYPE',
  'INVALID_RAW_IDENTIFIER',
]);

export const FideIdParseErrorCodeSchema = z.enum([
  'INVALID_FIDE_ID',
  'UNKNOWN_TYPE_CHAR',
]);

export const FideIdStatementErrorCodeSchema = z.enum([
  'INVALID_SUBJECT',
  'INVALID_PREDICATE',
  'INVALID_OBJECT',
]);

export const FideIdCalculateErrorResponseSchema = z.object({
  error: z.string(),
  code: FideIdCalculateErrorCodeSchema,
});

export const FideIdParseErrorResponseSchema = z.object({
  error: z.string(),
  code: FideIdParseErrorCodeSchema,
});

export const FideIdStatementErrorResponseSchema = z.object({
  error: z.string(),
  code: FideIdStatementErrorCodeSchema,
});
