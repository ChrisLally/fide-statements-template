import { z } from '@hono/zod-openapi';
import { FIDE_ENTITY_TYPE_MAP } from '@fide.work/fcp';

const ENTITY_TYPES = Object.keys(FIDE_ENTITY_TYPE_MAP) as [keyof typeof FIDE_ENTITY_TYPE_MAP, ...(keyof typeof FIDE_ENTITY_TYPE_MAP)[]];

export const IdentityResolveRequestSchema = z
    .object({
        fideId: z
            .string()
            .optional()
            .openapi({
                example: 'did:fide:0x15a1b2c3d4e5f6789012345678901234567890ab',
                description: 'Full Fide ID (did:fide:0x...). For raw identifiers, use entityType + sourceType + rawIdentifier instead.',
            }),
        entityType: z.enum(ENTITY_TYPES).optional().openapi({
            example: 'Person',
            description: 'Entity type (e.g. Person, Organization, Product, CreativeWork).',
        }),
        sourceType: z.enum(ENTITY_TYPES).optional().openapi({
            example: 'Product',
            description: 'Source type (e.g. Product, CreativeWork).',
        }),
        rawIdentifier: z.string().optional().openapi({
            example: 'https://x.com/alice',
            description: 'The raw identifier string (e.g. URL, handle).',
        }),
    })
    .refine(
        (data) =>
            (!!data.fideId && !data.entityType && !data.sourceType && !data.rawIdentifier) ||
            (!data.fideId && !!data.entityType && !!data.sourceType && !!data.rawIdentifier),
        { message: 'Provide either fideId OR (entityType, sourceType, rawIdentifier)' }
    )
    .openapi('IdentityResolveRequest');

export const IdentityResponseSchema = z.object({
    identityResolved: z.object({
        fideId: z.string().describe('Full canonical Fide ID (did:fide:0x...)'),
        rawIdentifier: z.string().describe('The human-readable raw identifier for the primary'),
        type: z.string().describe('Entity Type (e.g., Person, Organization)'),
        source: z.string().describe('Source Type (e.g., Product, CreativeWork)'),
    }),
    identifiers: z
        .array(
            z.object({
                fideId: z.string().describe('Full Fide ID for this alias (did:fide:0x...)'),
                rawIdentifier: z.string().describe('The raw identifier (e.g. URL, handle)'),
            })
        )
        .describe('All identifiers in the identity cluster (linked via trusted owl:sameAs)'),
}).openapi('IdentityResponse');
