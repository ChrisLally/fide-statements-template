import {
    SCHEMA_PREDICATES,
    PROV_PREDICATES,
    OWL_PREDICATES,
    SEC_PREDICATES,
    createStatement,
    calculateFideId,
    expandPredicateIdentifier
} from "../../dist/index.js";

console.log("📚 Schema & Predicate Helpers Example\n");

// Example 1: Using predicate constants
console.log("1. Using predicate constants...");
console.log("   Schema predicates:");
console.log("   - name:", SCHEMA_PREDICATES.name);
console.log("   - worksFor:", SCHEMA_PREDICATES.worksFor);
console.log("   - description:", SCHEMA_PREDICATES.description);
console.log();

console.log("   PROV predicates:");
console.log("   - wasGeneratedBy:", PROV_PREDICATES.wasGeneratedBy);
console.log("   - wasDerivedFrom:", PROV_PREDICATES.wasDerivedFrom);
console.log();

console.log("   OWL predicates:");
console.log("   - sameAs:", OWL_PREDICATES.sameAs);
console.log();

console.log("   Security predicates:");
console.log("   - controller:", SEC_PREDICATES.controller);
console.log("   - owner:", SEC_PREDICATES.owner);
console.log();

// Example 2: Get predicate Fide IDs
console.log("2. Getting predicate Fide IDs...");
const namePredicateFideId = await calculateFideId(
    "CreativeWork",
    "Product",
    expandPredicateIdentifier(SCHEMA_PREDICATES.name)
);
const worksForPredicateFideId = await calculateFideId(
    "CreativeWork",
    "Product",
    expandPredicateIdentifier(SCHEMA_PREDICATES.worksFor)
);
const wasGeneratedByPredicateFideId = await calculateFideId(
    "CreativeWork",
    "Product",
    expandPredicateIdentifier(PROV_PREDICATES.wasGeneratedBy)
);

console.log("✅ Predicate Fide IDs:");
console.log("   schema:name:", namePredicateFideId.slice(0, 30) + "...");
console.log("   schema:worksFor:", worksForPredicateFideId.slice(0, 30) + "...");
console.log("   prov:wasGeneratedBy:", wasGeneratedByPredicateFideId.slice(0, 30) + "...");
console.log();

// Example 3: Using predicates in statements (predicate shorthand expands automatically)
console.log("3. Creating statements with predicate constants...");

const statement1 = await createStatement({
    subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
    predicate: { rawIdentifier: SCHEMA_PREDICATES.name, entityType: 'CreativeWork', sourceType: 'Product' },
    object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
});

const statement2 = await createStatement({
    subject: { rawIdentifier: 'x.com/bob', entityType: 'Person', sourceType: 'Product' },
    predicate: { rawIdentifier: SCHEMA_PREDICATES.worksFor, entityType: 'CreativeWork', sourceType: 'Product' },
    object: { rawIdentifier: 'https://www.acme.com', entityType: 'Organization', sourceType: 'Product' }
});

console.log("✅ Created statements using predicate constants");
console.log("   Statement 1 Fide ID:", statement1.statementFideId?.slice(0, 30) + "...");
console.log("   Statement 2 Fide ID:", statement2.statementFideId?.slice(0, 30) + "...");
console.log();

console.log("🎉 Schema & predicate helpers example complete!");
