/**
 * FCP SDK - Fide ID Module
 * 
 * Re-exports all Fide ID utilities from submodules.
 */

// Core calculation functions
export { calculateFideId } from "./calculateFideId.js";
export { calculateStatementFideId } from "./calculateStatementFideId.js";

// Utility functions
export {
    isValidFideId,
    extractFideIdFingerprint,
    extractFideIdTypeAndSource,
    parseFideId,
    getStatementRawIdentifier
} from "./utils.js";

// Constants
export {
    FIDE_ENTITY_TYPE_MAP,
    FIDE_CHAR_TO_ENTITY_TYPE,
    FIDE_ID_PREFIX,
    FIDE_ID_HEX_LENGTH,
    FIDE_ID_LENGTH,
    FIDE_ID_FINGERPRINT_LENGTH
} from "./constants.js";

// Types
export type {
    FideEntityType,
    FideStatementPredicateEntityType,
    FideEntityTypeChar,
    FideId,
    FideFingerprint,
    ParsedFideId
} from "./types.js";
