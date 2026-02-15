/**
 * FCP SDK Broadcasting Utilities
 * 
 * Helpers for formatting attestations for JSONL registry files.
 * 
 * Note: This module provides formatting helpers. Actual Git operations
 * (commit, push) should be handled by your application using libraries
 * like `simple-git` or `isomorphic-git`.
 */

import type { AttestationResult } from "../attestation/index.js";
import type { Statement } from "../statement/build.js";

/**
 * Statement object in lean JSONL format
 * Uses short keys for efficiency: s/sr, p/pr, o/or
 */
export interface JSONLStatement {
    /** Subject Fide ID (full did:fide:0x... format) */
    s: string;
    /** Subject raw identifier */
    sr: string;
    /** Predicate Fide ID (full did:fide:0x... format) */
    p: string;
    /** Predicate raw identifier */
    pr: string;
    /** Object Fide ID (full did:fide:0x... format) */
    o: string;
    /** Object raw identifier */
    or: string;
}

/**
 * Lean attestation format for JSONL registry files
 * 
 * Optimized for indexers: minimal verbosity, all data needed for verification
 * and materialization. Each line is one attestation batch.
 * 
 * Format matches canonical attestation data structure: {m, r, s, u}
 * Indexer derives attestation Fide ID from these fields.
 */
export interface JSONLAttestation {
    /** Method: Signing method (e.g., "ed25519", "eip712", "eip191") */
    m: string;
    /** User: CAIP-10 signer identifier */
    u: string;
    /** Root: Merkle root commitment */
    r: string;
    /** Signature: Cryptographic signature */
    s: string;
    /** Timestamp: ISO 8601 UTC timestamp */
    t: string;
    /** Data: Array of statements in this batch */
    d: JSONLStatement[];
}

/**
 * Format an attestation result for JSONL output
 * 
 * Converts an AttestationResult into the lean JSONL format optimized for indexers.
 * Each line in the JSONL file should be one attestation batch (one signature covering
 * multiple statements via Merkle root).
 * 
 * Format uses short keys (m, u, r, s, t, d) matching the canonical attestation
 * data structure. Indexer derives attestation Fide ID from {m, r, s, u}.
 * 
 * @param attestationResult - The result from createAttestation
 * @param statements - The original statements that were attested (must match statementFideIds order)
 * @param signedAt - ISO timestamp when the attestation was signed (defaults to current time)
 * @returns Formatted attestation ready for JSONL output
 * 
 * @example
 * ```ts
 * const statements = await buildStatementBatch([...]);
 * const attestation = await createAttestation(statementFideIds, options);
 * const jsonlAttestation = formatAttestationForJSONL(attestation, statements);
 * 
 * // Write to JSONL file (one line per batch)
 * fs.appendFileSync('attestation.jsonl', JSON.stringify(jsonlAttestation) + '\n');
 * ```
 */
export function formatAttestationForJSONL(
    attestationResult: AttestationResult,
    statements: Statement[],
    signedAt: string = new Date().toISOString()
): JSONLAttestation {
    // Convert statements to lean JSONL format with short keys
    const jsonlStatements: JSONLStatement[] = statements.map(stmt => ({
        s: stmt.subjectFideId,
        sr: stmt.subjectRawIdentifier,
        p: stmt.predicateFideId,
        pr: stmt.predicateRawIdentifier,
        o: stmt.objectFideId,
        or: stmt.objectRawIdentifier
    }));
    
    return {
        m: attestationResult.attestationData.m,
        u: attestationResult.attestationData.u,
        r: attestationResult.merkleRoot,
        s: attestationResult.attestationData.s,
        t: signedAt,
        d: jsonlStatements
    };
}

/**
 * Generate the registry directory path for a given date
 * 
 * Follows the YYYY/MM/DD structure required for Fide attestation registries.
 * Uses UTC timezone for consistency across timezones.
 * 
 * @param date - Date object (defaults to current UTC date)
 * @returns Directory path (e.g., "2024/01/15")
 * 
 * @example
 * ```ts
 * const path = generateRegistryPath(new Date('2024-01-15T00:00:00Z'));
 * // Result: "2024/01/15"
 * ```
 */
export function generateRegistryPath(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * Generate a JSONL filename following the registry convention
 * 
 * Format: YYYY-MM-DD-{HHmm}-{sequence}.jsonl
 * Uses UTC timezone for consistency across timezones.
 * 
 * @param date - Date object (defaults to current UTC date)
 * @param sequence - Sequence number (defaults to 1)
 * @returns Filename (e.g., "2024-01-15-1400-1.jsonl")
 * 
 * @example
 * ```ts
 * const filename = generateJSONLFilename(new Date('2024-01-15T14:00:00Z'), 1);
 * // Result: "2024-01-15-1400-1.jsonl"
 * ```
 */
export function generateJSONLFilename(date: Date = new Date(), sequence: number = 1): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const timeWindow = `${hours}${minutes}`;
    
    return `${year}-${month}-${day}-${timeWindow}-${sequence}.jsonl`;
}

