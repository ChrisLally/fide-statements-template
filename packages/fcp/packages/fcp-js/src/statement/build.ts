/**
 * FCP SDK Statement Building Utilities
 * 
 * Helpers for creating statement objects with proper structure.
 */

import {
    calculateFideId,
    calculateStatementFideId
} from "../fide-id/index.js";
import type { FideId, FideEntityType, FideStatementPredicateEntityType } from "../fide-id/types.js";
import { assertStatementFideIdsPolicy, assertStatementInputPolicy } from "./policy.js";
import { createHash } from "node:crypto";

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
     * `rawIdentifier` must be a canonical full URL (https://...).
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
 * Batch build result with deterministic content root.
 */
export interface StatementBatchWithRoot {
    statements: Statement[];
    statementFideIds: FideId[];
    /** Deterministic SHA-256 hex hash of ordered statement Fide IDs. */
    root: string;
}

/**
 * Create a statement object with all required fields.
 *
 * Always computes Fide IDs from rawIdentifier + entityType + sourceType.
 * Predicates must be canonical full URLs.
 *
 * @param input - Statement input with subject, predicate, and object
 * @paramDefault input { subject: { rawIdentifier: "https://x.com/alice", entityType: "Person", sourceType: "Product" }, predicate: { rawIdentifier: "https://schema.org/name", entityType: "CreativeWork", sourceType: "Product" }, object: { rawIdentifier: "Alice", entityType: "CreativeWork", sourceType: "CreativeWork" } }
 * @returns Complete statement object
 * @throws Error if statement input policy fails, Fide ID format/policy checks fail, or statement ID derivation fails
 *
 * @example
 * ```ts
 * const statement = await createStatement({
 *   subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
 *   predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
 *   object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
 * });
 * ```
 */
export async function createStatement(input: StatementInput): Promise<Statement> {
    assertStatementInputPolicy(input);

    const subjectFideId = await calculateFideId(
        input.subject.entityType,
        input.subject.sourceType,
        input.subject.rawIdentifier
    );
    const subjectRawIdentifier = input.subject.rawIdentifier;

    let predicateFideId: FideId;
    let predicateRawIdentifier: string;

    predicateRawIdentifier = input.predicate.rawIdentifier;
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

    assertStatementFideIdsPolicy(subjectFideId, predicateFideId, objectFideId);

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
 * Create a statement using positional part fields.
 *
 * This is a convenience wrapper around `createStatement` for callers that prefer
 * positional arguments over a nested input object.
 *
 * @param subjectRawIdentifier Subject raw identifier.
 * @param subjectEntityType Subject entity type.
 * @param subjectSourceType Subject source entity type.
 * @param predicateRawIdentifier Predicate raw identifier (canonical URL).
 * @param predicateEntityType Predicate entity type.
 * @param predicateSourceType Predicate source entity type.
 * @param objectRawIdentifier Object raw identifier.
 * @param objectEntityType Object entity type.
 * @param objectSourceType Object source entity type.
 * @paramDefault subjectRawIdentifier https://x.com/alice
 * @paramDefault subjectEntityType Person
 * @paramDefault subjectSourceType Product
 * @paramDefault predicateRawIdentifier https://schema.org/name
 * @paramDefault predicateEntityType CreativeWork
 * @paramDefault predicateSourceType Product
 * @paramDefault objectRawIdentifier Alice
 * @paramDefault objectEntityType CreativeWork
 * @paramDefault objectSourceType CreativeWork
 * @returns Complete statement object
 * @throws Error if statement input policy fails, Fide ID format/policy checks fail, or statement ID derivation fails
 */
export async function createStatementFromParts(
    subjectRawIdentifier: string,
    subjectEntityType: FideEntityType,
    subjectSourceType: FideEntityType,
    predicateRawIdentifier: string,
    predicateEntityType: FideStatementPredicateEntityType,
    predicateSourceType: FideEntityType,
    objectRawIdentifier: string,
    objectEntityType: FideEntityType,
    objectSourceType: FideEntityType
): Promise<Statement> {
    return createStatement({
        subject: {
            rawIdentifier: subjectRawIdentifier,
            entityType: subjectEntityType,
            sourceType: subjectSourceType
        },
        predicate: {
            rawIdentifier: predicateRawIdentifier,
            entityType: predicateEntityType,
            sourceType: predicateSourceType
        },
        object: {
            rawIdentifier: objectRawIdentifier,
            entityType: objectEntityType,
            sourceType: objectSourceType
        }
    });
}

/**
 * Build a batch of statements and derive a deterministic batch root.
 *
 * Root derivation:
 * - `statementFideIds` are lexicographically sorted
 * - Sorted IDs are joined with `\\n`
 * - SHA-256 is computed over that byte sequence
 * - Result is returned as lowercase hex string
 *
 * @param inputs Array of statement inputs.
 * @paramDefault inputs [{ subject: { rawIdentifier: "https://x.com/alice", entityType: "Person", sourceType: "Product" }, predicate: { rawIdentifier: "https://schema.org/name", entityType: "CreativeWork", sourceType: "Product" }, object: { rawIdentifier: "Alice", entityType: "CreativeWork", sourceType: "CreativeWork" } }]
 * @returns Statements, statement IDs (input order), and deterministic root hash
 * @throws Error if one or more built statements are missing `statementFideId`
 */
export async function buildStatementBatchWithRoot(inputs: StatementInput[]): Promise<StatementBatchWithRoot> {
    const statements = await Promise.all(inputs.map((input) => createStatement(input)));
    const statementFideIds = statements
        .map((s) => s.statementFideId)
        .filter((id): id is FideId => !!id);

    if (statementFideIds.length !== statements.length) {
        throw new Error("Batch build failed: one or more statements are missing statementFideId.");
    }

    const canonicalIds = [...statementFideIds].sort();
    const root = createHash("sha256").update(canonicalIds.join("\n")).digest("hex");

    return {
        statements,
        statementFideIds,
        root
    };
}
