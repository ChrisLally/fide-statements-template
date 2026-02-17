import { assertFideId, parseFideId } from "../fide-id/index.js";
import type { StatementInput } from "./build.js";

function describeValue(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    const kind = typeof value;
    if (kind === "string") return `string(${JSON.stringify(value)})`;
    if (kind === "number" || kind === "boolean" || kind === "bigint") return `${kind}(${String(value)})`;
    if (kind === "function") return "function";
    if (Array.isArray(value)) return `array(len=${value.length})`;
    if (kind === "object") {
        try {
            return `object(${JSON.stringify(value)})`;
        } catch {
            return "object([unserializable])";
        }
    }
    return kind;
}

/**
 * Enforce statement input policy before deriving Fide IDs.
 */
export function assertStatementInputPolicy(input: StatementInput): void {
    if (!input || typeof input !== "object") {
        throw new Error(
            `Invalid statement input: expected object with subject, predicate, and object; got ${describeValue(input)}.`
        );
    }
    if (!input.subject || typeof input.subject !== "object") {
        throw new Error(
            `Invalid statement input: expected subject object; got ${describeValue((input as any).subject)}.`
        );
    }
    if (!input.predicate || typeof input.predicate !== "object") {
        throw new Error(
            `Invalid statement input: expected predicate object; got ${describeValue((input as any).predicate)}.`
        );
    }
    if (!input.object || typeof input.object !== "object") {
        throw new Error(
            `Invalid statement input: expected object object at input.object; got ${describeValue((input as any).object)}.`
        );
    }

    if (typeof input.subject.rawIdentifier !== "string") {
        throw new Error(
            `Invalid statement input: expected subject.rawIdentifier as string; got ${describeValue((input as any).subject?.rawIdentifier)}.`
        );
    }
    if (typeof input.subject.entityType !== "string") {
        throw new Error(
            `Invalid statement input: expected subject.entityType as string; got ${describeValue((input as any).subject?.entityType)}.`
        );
    }
    if (typeof input.subject.sourceType !== "string") {
        throw new Error(
            `Invalid statement input: expected subject.sourceType as string; got ${describeValue((input as any).subject?.sourceType)}.`
        );
    }

    if (typeof input.predicate.rawIdentifier !== "string") {
        throw new Error(
            `Invalid statement input: expected predicate.rawIdentifier as string; got ${describeValue((input as any).predicate?.rawIdentifier)}.`
        );
    }
    if (typeof input.predicate.entityType !== "string") {
        throw new Error(
            `Invalid statement input: expected predicate.entityType as string; got ${describeValue((input as any).predicate?.entityType)}.`
        );
    }
    if (typeof input.predicate.sourceType !== "string") {
        throw new Error(
            `Invalid statement input: expected predicate.sourceType as string; got ${describeValue((input as any).predicate?.sourceType)}.`
        );
    }

    if (typeof input.object.rawIdentifier !== "string") {
        throw new Error(
            `Invalid statement input: expected object.rawIdentifier as string; got ${describeValue((input as any).object?.rawIdentifier)}.`
        );
    }
    if (typeof input.object.entityType !== "string") {
        throw new Error(
            `Invalid statement input: expected object.entityType as string; got ${describeValue((input as any).object?.entityType)}.`
        );
    }
    if (typeof input.object.sourceType !== "string") {
        throw new Error(
            `Invalid statement input: expected object.sourceType as string; got ${describeValue((input as any).object?.sourceType)}.`
        );
    }

    if (input.predicate.entityType !== "CreativeWork") {
        throw new Error(
            `Invalid predicate entityType: ${input.predicate.entityType}. Expected CreativeWork.`
        );
    }

    if (input.predicate.sourceType !== "Product") {
        throw new Error(
            `Invalid predicate sourceType: ${input.predicate.sourceType}. Expected Product.`
        );
    }

    // Predicate URL validity/canonicalization is enforced by normalizePredicateRawIdentifier()
    // in the statement building path.
}

/**
 * Normalize rawIdentifier only when it is URL-like (http/https).
 *
 * Rules for URL-like values:
 * - must parse as an absolute URL
 * - lowercase scheme + host
 * - remove default ports (80 for http, 443 for https)
 * - preserve path/query/fragment case
 *
 * Non URL-like values are returned unchanged.
 */
export function normalizeIfUrlLike(rawIdentifier: string, ifSkipNormalizeUrl = false): string {
    if (ifSkipNormalizeUrl) {
        return rawIdentifier;
    }

    if (!/^https?:\/\//i.test(rawIdentifier)) {
        return rawIdentifier;
    }

    let url: URL;
    try {
        url = new URL(rawIdentifier);
    } catch {
        throw new Error(
            `Invalid URL-like rawIdentifier: ${rawIdentifier}. Expected absolute URL when using http(s) format.`
        );
    }

    const protocol = url.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
        return rawIdentifier;
    }

    url.protocol = protocol;
    url.hostname = url.hostname.toLowerCase();
    if ((protocol === "https:" && url.port === "443") || (protocol === "http:" && url.port === "80")) {
        url.port = "";
    }

    return url.toString();
}

/**
 * Canonicalize and validate predicate rawIdentifier URLs.
 *
 * Policy:
 * - must be an absolute URL
 * - must use https
 * - username/password are not allowed
 * - normalize scheme + host case only
 * - remove default https port (443)
 * - preserve path/query/fragment case
 */
export function normalizePredicateRawIdentifier(rawIdentifier: string, ifSkipNormalizeUrl = false): string {
    if (ifSkipNormalizeUrl) {
        let skipUrl: URL;
        try {
            skipUrl = new URL(rawIdentifier);
        } catch {
            throw new Error(
                `Invalid predicate rawIdentifier: ${rawIdentifier}. Expected canonical full URL (e.g. https://schema.org/name).`
            );
        }

        if (skipUrl.protocol.toLowerCase() !== "https:") {
            throw new Error(
                `Invalid predicate rawIdentifier protocol: ${rawIdentifier}. Expected https URL.`
            );
        }

        if (skipUrl.username || skipUrl.password) {
            throw new Error(
                `Invalid predicate rawIdentifier: ${rawIdentifier}. URL userinfo is not allowed.`
            );
        }

        return rawIdentifier;
    }

    const normalized = normalizeIfUrlLike(rawIdentifier, ifSkipNormalizeUrl);

    let url: URL;
    try {
        url = new URL(normalized);
    } catch {
        throw new Error(
            `Invalid predicate rawIdentifier: ${rawIdentifier}. Expected canonical full URL (e.g. https://schema.org/name).`
        );
    }

    if (url.protocol.toLowerCase() !== "https:") {
        throw new Error(
            `Invalid predicate rawIdentifier protocol: ${rawIdentifier}. Expected https URL.`
        );
    }

    if (url.username || url.password) {
        throw new Error(
            `Invalid predicate rawIdentifier: ${rawIdentifier}. URL userinfo is not allowed.`
        );
    }

    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    if (url.port === "443") {
        url.port = "";
    }

    return url.toString();
}

/**
 * Enforce statement ID policy after deriving subject/predicate/object Fide IDs.
 */
export function assertStatementFideIdsPolicy(
    subjectFideId: string,
    predicateFideId: string,
    objectFideId: string
): void {
    // Predicate combo policy is enforced at input level (entityType/sourceType).
    // Keep ID-level checks here for subject/object Statement-source restrictions.
    assertRoleFideIdPolicy(subjectFideId, "subject");
    assertRoleFideIdPolicy(objectFideId, "object");
}

function assertRoleFideIdPolicy(fideId: string, role: "subject" | "object"): void {
    assertFideId(fideId);
    const { typeChar, sourceChar } = parseFideId(fideId);

    if (sourceChar !== "0") return;
    if (typeChar === "0") return;
    const label = role ? ` ${role}` : "";
    throw new Error(
        `Invalid Fide ID for statement${label}: ${fideId}. ` +
        `Protocol disallows Statement source (0xX0) for non-Statement entities. ` +
        `Use a concrete source (e.g. Product 0x15, Organization 0x25) instead of Statement-derived IDs.`
    );
}
