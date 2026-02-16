/**
 * FCP SDK Constants
 * Central location for all protocol constants
 */

/**
 * Entity Type Map
 * Maps FCP entity type names to their single-character hex codes.
 * Used as both Part 1 (Entity Type) and Part 2 (Identifier Source) in Fide IDs.
 */
export const FIDE_ENTITY_TYPE_MAP = {
    // Fide Context Protocol Types
    Statement: "0",

    // Active Entities
    Person: "1",
    Organization: "2",
    AutonomousAgent: "7",

    // Inactive Entities
    Place: "3",
    Event: "4",
    Product: "5",
    CreativeWork: "6"
} as const;

/**
 * Reverse lookup: character code to entity type name
 */
export const FIDE_CHAR_TO_ENTITY_TYPE: Record<string, keyof typeof FIDE_ENTITY_TYPE_MAP> = {
    "0": "Statement",
    "1": "Person",
    "2": "Organization",
    "7": "AutonomousAgent",
    "3": "Place",
    "4": "Event",
    "5": "Product",
    "6": "CreativeWork"
};

/**
 * Fide ID Prefix
 * All Fide IDs start with this constant prefix (W3C DID format)
 */
export const FIDE_ID_PREFIX = "did:fide:0x" as const;

/**
 * Fide ID Length (excluding prefix)
 * 40 hex characters: 1 (type) + 1 (source) + 38 (fingerprint)
 */
export const FIDE_ID_HEX_LENGTH = 40;

/**
 * Fide ID Length (including prefix)
 * "did:fide:0x" (11) + 40 hex = 51 characters
 */
export const FIDE_ID_LENGTH = FIDE_ID_PREFIX.length + FIDE_ID_HEX_LENGTH;

/**
 * Fingerprint Length
 * Last 38 hex characters (19 bytes) of SHA-256 hash
 */
export const FIDE_ID_FINGERPRINT_LENGTH = 38;
