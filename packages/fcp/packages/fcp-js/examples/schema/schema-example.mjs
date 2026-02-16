import {
    createStatement,
    calculateFideId
} from "../../dist/index.js";

console.log("📚 Predicate URL Example\n");

// Example 1: Use canonical predicate URLs directly
console.log("1. Using canonical predicate URLs...");
const schemaName = "https://schema.org/name";
const schemaWorksFor = "https://schema.org/worksFor";
const provWasGeneratedBy = "https://www.w3.org/ns/prov#wasGeneratedBy";
console.log("   -", schemaName);
console.log("   -", schemaWorksFor);
console.log("   -", provWasGeneratedBy);
console.log();

// Example 2: Get predicate Fide IDs
console.log("2. Getting predicate Fide IDs...");
const namePredicateFideId = await calculateFideId(
    "CreativeWork",
    "Product",
    schemaName
);
const worksForPredicateFideId = await calculateFideId(
    "CreativeWork",
    "Product",
    schemaWorksFor
);
const wasGeneratedByPredicateFideId = await calculateFideId(
    "CreativeWork",
    "Product",
    provWasGeneratedBy
);

console.log("✅ Predicate Fide IDs:");
console.log("   schema.org/name:", namePredicateFideId.slice(0, 30) + "...");
console.log("   schema.org/worksFor:", worksForPredicateFideId.slice(0, 30) + "...");
console.log("   prov#wasGeneratedBy:", wasGeneratedByPredicateFideId.slice(0, 30) + "...");
console.log();

// Example 3: Create statements with canonical predicate URLs
console.log("3. Creating statements with canonical URLs...");

const statement1 = await createStatement({
    subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
    predicate: { rawIdentifier: schemaName, entityType: 'CreativeWork', sourceType: 'Product' },
    object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
});

const statement2 = await createStatement({
    subject: { rawIdentifier: 'x.com/bob', entityType: 'Person', sourceType: 'Product' },
    predicate: { rawIdentifier: schemaWorksFor, entityType: 'CreativeWork', sourceType: 'Product' },
    object: { rawIdentifier: 'https://www.acme.com', entityType: 'Organization', sourceType: 'Product' }
});

console.log("✅ Created statements using canonical URLs");
console.log("   Statement 1 Fide ID:", statement1.statementFideId?.slice(0, 30) + "...");
console.log("   Statement 2 Fide ID:", statement2.statementFideId?.slice(0, 30) + "...");
console.log();

console.log("🎉 Predicate URL example complete!");
