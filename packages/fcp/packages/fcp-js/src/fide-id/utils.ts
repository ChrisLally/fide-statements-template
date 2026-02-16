/**
 * FCP SDK Utilities
 * Helper functions for working with Fide IDs
 */

import {
    FIDE_ID_PREFIX,
    FIDE_ID_LENGTH,
    FIDE_CHAR_TO_ENTITY_TYPE
} from "./constants.js";
import type { FideId, ParsedFideId, FideEntityType, FideEntityTypeChar } from "./types.js";

/**
 * Assert that a value is a properly formatted Fide ID.
 *
 * Valid format is:
 * `did:fide:0x` prefix followed by exactly 40 hexadecimal characters (case-insensitive).
 *
 * @param value The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault value did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @returns void
 * @throws TypeError if value is not a string
 * @throws Error if value is not a valid Fide ID format
 */
export function assertFideId(value: string): asserts value is FideId {
    if (typeof value !== "string") {
        throw new TypeError(`Invalid Fide ID: expected string, got ${typeof value}`);
    }
    if (value.length !== FIDE_ID_LENGTH) {
        throw new Error(`Invalid Fide ID format: ${value}. Expected ${FIDE_ID_PREFIX}... (${FIDE_ID_LENGTH} chars)`);
    }
    if (!value.startsWith(FIDE_ID_PREFIX)) {
        throw new Error(`Invalid Fide ID format: ${value}. Expected ${FIDE_ID_PREFIX}... (${FIDE_ID_LENGTH} chars)`);
    }

    const hex = value.slice(FIDE_ID_PREFIX.length);
    if (!/^[0-9a-f]{40}$/i.test(hex)) {
        throw new Error(`Invalid Fide ID format: ${value}. Expected ${FIDE_ID_PREFIX}... (${FIDE_ID_LENGTH} chars)`);
    }
}

/**
 * Parse a Fide ID into its constituent components.
 *
 * Decomposes a Fide ID into entity type, source type, and fingerprint, converting hex characters
 * to their corresponding entity type names.
 *
 * @param fideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault fideId did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @returns Parsed Fide ID components. `entityType` and `sourceType` are resolved via `FIDE_CHAR_TO_ENTITY_TYPE`.
 * @throws Error if invalid Fide ID format or if type characters do not map to known entity types
 */
export function parseFideId(fideId: FideId): ParsedFideId {
    assertFideId(fideId);

    const typeChar = fideId[FIDE_ID_PREFIX.length] as FideEntityTypeChar;
    const sourceChar = fideId[FIDE_ID_PREFIX.length + 1] as FideEntityTypeChar;
    const fingerprint = fideId.slice(FIDE_ID_PREFIX.length + 2);

    const entityType = FIDE_CHAR_TO_ENTITY_TYPE[typeChar];
    const sourceType = FIDE_CHAR_TO_ENTITY_TYPE[sourceChar];

    if (!entityType) {
        throw new Error(`Unknown entity type character: ${typeChar}`);
    }
    if (!sourceType) {
        throw new Error(`Unknown source type character: ${sourceChar}`);
    }

    return {
        fideId,
        typeChar,
        sourceChar,
        entityType,
        sourceType,
        fingerprint
    };
}
