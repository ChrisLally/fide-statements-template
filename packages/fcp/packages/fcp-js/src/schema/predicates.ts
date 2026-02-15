/**
 * FCP SDK Schema Utilities
 * 
 * Common predicate constants and helpers for working with FCP schema predicates.
 * 
 * Note: The SDK handles deterministic JSON serialization (RFC 8785) internally
 * following the json-stable-stringify philosophy - using manually ordered keys
 * for all Fide ID calculations. No external dependencies are required.
 */

/** Prefix to canonical base URL. Schema uses /, others use #. */
const PREDICATE_NAMESPACES: Record<string, string> = {
    schema: "https://schema.org/",
    owl: "https://www.w3.org/2002/07/owl#",
    prov: "https://www.w3.org/ns/prov#",
    sec: "https://w3id.org/security#",
    skos: "https://www.w3.org/2004/02/skos/core#"
};

/**
 * Expand shorthand predicate identifiers to full canonical URLs.
 * `calculateFideId` stays dumb; this provides a convenience layer for predicates.
 *
 * Accepts shorthand (e.g. `schema:name`, `owl:sameAs`) and returns the full IRI.
 * Pass-through for strings that already look like full URLs (contain `://`).
 *
 * @param predicate - Shorthand (e.g. `schema:name`) or full URL
 * @returns Full canonical URL (e.g. `https://schema.org/name`)
 *
 * @example
 * ```ts
 * expandPredicateIdentifier('schema:name')     // 'https://schema.org/name'
 * expandPredicateIdentifier('owl:sameAs')      // 'https://www.w3.org/2002/07/owl#sameAs'
 * expandPredicateIdentifier('https://schema.org/name')  // unchanged
 * ```
 */
export function expandPredicateIdentifier(predicate: string): string {
    if (predicate.includes("://")) return predicate;
    const colon = predicate.indexOf(":");
    if (colon < 1) return predicate;
    const prefix = predicate.slice(0, colon);
    const base = PREDICATE_NAMESPACES[prefix];
    if (!base) return predicate;
    return base + predicate.slice(colon + 1);
}

/**
 * Predicate namespace identifiers.
 *
 * @remarks
 * Identifies which ontology namespace a predicate belongs to:
 * - `schema`: Schema.org predicates for common attributes and relationships
 * - `prov`: PROV-O (Provenance Ontology) predicates for tracking lineage
 * - `owl`: OWL (Web Ontology Language) predicates for ontology relationships
 * - `sec`: W3C Security Vocabulary predicates for access control
 */
export type PredicateNamespace = 'schema' | 'prov' | 'owl' | 'sec';

/**
 * Common Schema.org predicates.
 *
 * These are commonly used predicates in FCP statements. For the complete list,
 * see [Schema.org](https://schema.org/).
 *
 * @remarks
 * This is a record of predicate strings following the `schema:` namespace convention.
 * Pass directly to functions expecting predicate strings.
 */
export const SCHEMA_PREDICATES = {
    // Attributes
    name: 'schema:name',
    description: 'schema:description',
    type: 'schema:type',
    url: 'schema:url',
    image: 'schema:image',
    
    // Relationships
    worksFor: 'schema:worksFor',
    memberOf: 'schema:memberOf',
    parentOrganization: 'schema:parentOrganization',
    knows: 'schema:knows',
    follows: 'schema:follows',
    
    // Actions
    actionStatus: 'schema:actionStatus',
    
    // Other
    identifier: 'schema:identifier',
    sameAs: 'schema:sameAs'
} as const;

/**
 * PROV-O (Provenance Ontology) predicates.
 *
 * Used for tracking provenance and lineage in FCP statements.
 *
 * @remarks
 * This is a record of predicate strings following the `prov:` namespace convention.
 * Pass directly to functions expecting predicate strings.
 */
export const PROV_PREDICATES = {
    wasGeneratedBy: 'prov:wasGeneratedBy',
    wasDerivedFrom: 'prov:wasDerivedFrom',
    wasAssociatedWith: 'prov:wasAssociatedWith',
    wasAttributedTo: 'prov:wasAttributedTo',
    wasRevisionOf: 'prov:wasRevisionOf',
    wasQuotedFrom: 'prov:wasQuotedFrom',
    actedOnBehalfOf: 'prov:actedOnBehalfOf'
} as const;

/**
 * OWL (Web Ontology Language) predicates.
 *
 * Used for ontology relationships.
 *
 * @remarks
 * This is a record of predicate strings following the `owl:` namespace convention.
 * Pass directly to functions expecting predicate strings.
 */
export const OWL_PREDICATES = {
    sameAs: 'owl:sameAs',
    differentFrom: 'owl:differentFrom',
    equivalentClass: 'owl:equivalentClass',
    equivalentProperty: 'owl:equivalentProperty'
} as const;

/**
 * W3C Security Vocabulary predicates.
 *
 * Used for security and access control relationships.
 *
 * @remarks
 * This is a record of predicate strings following the `sec:` namespace convention.
 * Pass directly to functions expecting predicate strings.
 */
export const SEC_PREDICATES = {
    controller: 'sec:controller',
    owner: 'sec:owner',
    authorizedBy: 'sec:authorizedBy'
} as const;
