/**
 * @fide.work/fcp - Fide Context Protocol SDK
 *
 * Core functions for calculating Fide IDs and working with
 * the FCP protocol in JavaScript/TypeScript.
 */

// ============================================================================
// FIDE ID MODULE
// ============================================================================

// Core calculation functions
export { calculateFideId, calculateStatementFideId } from "./fide-id/index.js";

// Utility functions
export {
    isValidFideId,
    extractFideIdFingerprint,
    extractFideIdTypeAndSource,
    parseFideId,
    getStatementRawIdentifier
} from "./fide-id/index.js";

// Constants
export {
    FIDE_ENTITY_TYPE_MAP,
    FIDE_CHAR_TO_ENTITY_TYPE,
    FIDE_ID_PREFIX,
    FIDE_ID_HEX_LENGTH,
    FIDE_ID_LENGTH,
    FIDE_ID_FINGERPRINT_LENGTH
} from "./fide-id/index.js";

// Types
export type {
    FideEntityType,
    FideStatementPredicateEntityType,
    FideStatementPredicateSourceType,
    FideEntityTypeChar,
    FideId,
    FideFingerprint,
    ParsedFideId
} from "./fide-id/index.js";

// ============================================================================
// STATEMENT MODULE
// ============================================================================

export {
    createStatement,
    buildStatementBatchWithRoot,
    type StatementInput,
    type Statement,
    type StatementBatchWithRoot
} from "./statement/index.js";
