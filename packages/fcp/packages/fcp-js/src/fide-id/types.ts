/**
 * FCP SDK Types
 * Central location for all TypeScript type definitions
 */

import { FIDE_ENTITY_TYPE_MAP } from "./constants.js";

/**
 * Valid FCP entity type names derived from `FIDE_ENTITY_TYPE_MAP`.
 * @docs /fcp/docs/entities
 */
export type FideEntityType = keyof typeof FIDE_ENTITY_TYPE_MAP;

/**
 * Allowed entity types for statement predicates.
 *
 * - `CreativeWork`: schema/ontology predicate IRIs
 * @docs /fcp/docs/schema/#predicate
*/
export type FideStatementPredicateEntityType = "CreativeWork";

/**
 * Allowed source types for statement predicates.
 *
 * - `Product`: predicate IRIs are treated as product-sourced vocabulary terms
 */
export type FideStatementPredicateSourceType = "Product";

/**
 * Single-character FCP type codes (hex) derived from `FIDE_ENTITY_TYPE_MAP`.
 */
export type FideEntityTypeChar = typeof FIDE_ENTITY_TYPE_MAP[FideEntityType];

/**
 * Full Fide ID format (with did:fide:0x prefix)
 */
export type FideId = `did:fide:0x${string}`;

/**
 * Fide ID fingerprint segment (38 hex characters, 19 bytes).
 */
export type FideFingerprint = string;

/**
 * Parsed Fide ID components.
 */
export interface ParsedFideId {
    /** The full Fide ID string */
    fideId: FideId;
    /** Entity type code (1 hex char from Part 1 of the Fide ID). */
    typeChar: FideEntityTypeChar;
    /** Source type code (1 hex char from Part 2 of the Fide ID). */
    sourceChar: FideEntityTypeChar;
    /** Resolved entity type name from `FIDE_CHAR_TO_ENTITY_TYPE[typeChar]`. */
    entityType: FideEntityType;
    /** Resolved source type name from `FIDE_CHAR_TO_ENTITY_TYPE[sourceChar]`. */
    sourceType: FideEntityType;
    /** Fingerprint segment (Part 3, 38 hex chars). */
    fingerprint: FideFingerprint;
}
