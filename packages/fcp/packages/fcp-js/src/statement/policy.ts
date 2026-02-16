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

    if (!input.predicate.rawIdentifier.includes("://")) {
        throw new Error(
            `Invalid predicate rawIdentifier: ${input.predicate.rawIdentifier}. Expected canonical full URL (e.g. https://schema.org/name).`
        );
    }
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
