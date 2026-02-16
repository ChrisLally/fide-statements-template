/**
 * FCP SDK Statement Building Utilities
 * 
 * Helpers for creating statement objects with proper structure.
 */

import {
    calculateFideId,
    calculateStatementFideId,
    validateFideIdForStorage
} from "../fide-id/index.js";
import type { FideId, FideEntityType, FideStatementPredicateEntityType } from "../fide-id/types.js";

/**
 * Input for creating a statement.
 *
 * All triples require rawIdentifier + entityType + sourceType. The SDK always computes
 * Fide IDs internally to avoid trust/validation issues with pre-calculated hashes.
 */
export interface StatementInput {
    /** Subject - raw identifier with entity type and source type */
    subject: { rawIdentifier: string; entityType: FideEntityType; sourceType: FideEntityType };
    /**
     * Predicate - explicit raw identifier with entity type and source type.
     * `rawIdentifier` may be shorthand (e.g. schema:name, owl:sameAs) or full URL.
     * Entity type must be CreativeWork.
     */
    predicate: {
        rawIdentifier: string;
        entityType: FideStatementPredicateEntityType;
        sourceType: FideEntityType;
    };
    /** Object - raw identifier with entity type and source type */
    object: { rawIdentifier: string; entityType: FideEntityType; sourceType: FideEntityType };
}

/**
 * Complete statement object with all required fields
 * 
 * **Important**: Both Fide IDs and raw identifiers are required because:
 * - Fide IDs are one-way hashes - cannot be reversed to get raw identifiers
 * - Protocol specification requires both fields
 * - Indexers need raw identifiers for lookup tables and human-readable display
 * - Enables mapping back to human-readable identifiers for debugging and display
 */
export interface Statement {
    /** Subject Fide ID */
    subjectFideId: FideId;
    /** Subject raw identifier (required - cannot be derived from Fide ID) */
    subjectRawIdentifier: string;
    /** Predicate Fide ID */
    predicateFideId: FideId;
    /** Predicate raw identifier (required - cannot be derived from Fide ID) */
    predicateRawIdentifier: string;
    /** Object Fide ID */
    objectFideId: FideId;
    /** Object raw identifier (required - cannot be derived from Fide ID) */
    objectRawIdentifier: string;
    /** Statement Fide ID (calculated) */
    statementFideId?: FideId;
}

/**
 * Create a statement object with all required fields.
 *
 * Always computes Fide IDs from rawIdentifier + entityType + sourceType.
 * Predicates must be canonical full URLs.
 *
 * @param input - Statement input with subject, predicate, and object
 * @returns Complete statement object
 *
 * @example
 * ```ts
 * const statement = await createStatement({
 *   subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
 *   predicate: { rawIdentifier: 'schema:name', entityType: 'CreativeWork', sourceType: 'Product' },
 *   object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
 * });
 * ```
 */
export async function createStatement(input: StatementInput): Promise<Statement> {
    const subjectFideId = await calculateFideId(
        input.subject.entityType,
        input.subject.sourceType,
        input.subject.rawIdentifier
    );
    const subjectRawIdentifier = input.subject.rawIdentifier;

    let predicateFideId: FideId;
    let predicateRawIdentifier: string;

    if (input.predicate.entityType !== "CreativeWork") {
        throw new Error(
            `Invalid predicate entityType: ${input.predicate.entityType}. Expected CreativeWork.`
        );
    }

    predicateRawIdentifier = input.predicate.rawIdentifier;
    if (!predicateRawIdentifier.includes("://")) {
        throw new Error(
            `Invalid predicate rawIdentifier: ${predicateRawIdentifier}. Expected canonical full URL (e.g. https://schema.org/name).`
        );
    }
    predicateFideId = await calculateFideId(
        input.predicate.entityType,
        input.predicate.sourceType,
        predicateRawIdentifier
    );

    const objectFideId = await calculateFideId(
        input.object.entityType,
        input.object.sourceType,
        input.object.rawIdentifier
    );
    const objectRawIdentifier = input.object.rawIdentifier;

    // Enforce protocol rule: no 0xX0 except 0x00 and 0xaa in statement components
    validateFideIdForStorage(subjectFideId, "subject");
    validateFideIdForStorage(predicateFideId, "predicate");
    validateFideIdForStorage(objectFideId, "object");

    // Calculate statement Fide ID
    const statementFideId = await calculateStatementFideId(
        subjectFideId,
        predicateFideId,
        objectFideId
    );

    return {
        subjectFideId,
        subjectRawIdentifier,
        predicateFideId,
        predicateRawIdentifier,
        objectFideId,
        objectRawIdentifier,
        statementFideId
    };
}

/**
 * Build a batch of statements from an array of inputs.
 *
 * @param inputs - Array of statement inputs
 * @returns Array of complete statement objects
 *
 * @example
 * ```ts
 * const statements = await buildStatementBatch([
 *   {
 *     subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
 *     predicate: { rawIdentifier: 'schema:name', entityType: 'CreativeWork', sourceType: 'Product' },
 *     object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
 *   },
 *   {
 *     subject: { rawIdentifier: 'https://x.com/bob', entityType: 'Person', sourceType: 'Product' },
 *     predicate: { rawIdentifier: 'schema:worksFor', entityType: 'CreativeWork', sourceType: 'Product' },
 *     object: { rawIdentifier: 'https://www.acme.com', entityType: 'Organization', sourceType: 'Product' }
 *   }
 * ]);
 * ```
 */
export async function buildStatementBatch(inputs: StatementInput[]): Promise<Statement[]> {
    return Promise.all(inputs.map(input => createStatement(input)));
}
