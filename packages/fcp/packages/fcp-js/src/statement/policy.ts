import { extractFideIdTypeAndSource } from "../fide-id/index.js";
import type { StatementInput } from "./build.js";

/**
 * Enforce statement input policy before deriving Fide IDs.
 */
export function assertStatementInputPolicy(input: StatementInput): void {
    if (!input || typeof input !== "object") {
        throw new Error("Invalid statement input: expected object with subject, predicate, and object.");
    }
    if (!input.subject || typeof input.subject !== "object") {
        throw new Error("Invalid statement input: missing subject object.");
    }
    if (!input.predicate || typeof input.predicate !== "object") {
        throw new Error("Invalid statement input: missing predicate object.");
    }
    if (!input.object || typeof input.object !== "object") {
        throw new Error("Invalid statement input: missing object object.");
    }

    if (typeof input.subject.rawIdentifier !== "string") {
        throw new Error("Invalid statement input: subject.rawIdentifier must be a string.");
    }
    if (typeof input.subject.entityType !== "string") {
        throw new Error("Invalid statement input: subject.entityType must be a string.");
    }
    if (typeof input.subject.sourceType !== "string") {
        throw new Error("Invalid statement input: subject.sourceType must be a string.");
    }

    if (typeof input.predicate.rawIdentifier !== "string") {
        throw new Error("Invalid statement input: predicate.rawIdentifier must be a string.");
    }
    if (typeof input.predicate.entityType !== "string") {
        throw new Error("Invalid statement input: predicate.entityType must be a string.");
    }
    if (typeof input.predicate.sourceType !== "string") {
        throw new Error("Invalid statement input: predicate.sourceType must be a string.");
    }

    if (typeof input.object.rawIdentifier !== "string") {
        throw new Error("Invalid statement input: object.rawIdentifier must be a string.");
    }
    if (typeof input.object.entityType !== "string") {
        throw new Error("Invalid statement input: object.entityType must be a string.");
    }
    if (typeof input.object.sourceType !== "string") {
        throw new Error("Invalid statement input: object.sourceType must be a string.");
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
    const { typeChar, sourceChar } = extractFideIdTypeAndSource(fideId);

    if (sourceChar !== "0") return;
    if (typeChar === "0") return;
    const label = role ? ` ${role}` : "";
    throw new Error(
        `Invalid Fide ID for statement${label}: ${fideId}. ` +
        `Protocol disallows Statement source (0xX0) for non-Statement entities. ` +
        `Use a concrete source (e.g. Product 0x15, Organization 0x25) instead of Statement-derived IDs.`
    );
}
