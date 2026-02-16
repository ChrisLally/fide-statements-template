import {
    createStatement,
    batchStatementsWithRoot
} from "../../dist/index.js";

console.log("📝 Statement Building Example\n");

// Example 1: Create a single statement
console.log("1. Creating statement...");
const statement1 = await createStatement({
    subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
    predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
    object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
});

console.log("✅ Statement created:");
console.log("   Subject Fide ID:", statement1.subjectFideId.slice(0, 30) + "...");
console.log("   Predicate:", statement1.predicateRawIdentifier);
console.log("   Statement Fide ID:", statement1.statementFideId?.slice(0, 30) + "...\n");

// Example 2: Build a batch of statements
console.log("2. Building batch of statements...");
const { statements, statementFideIds, root } = await batchStatementsWithRoot([
    {
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    },
    {
        subject: { rawIdentifier: 'https://x.com/bob', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/worksFor', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'https://www.acme.com', entityType: 'Organization', sourceType: 'Product' }
    },
    {
        subject: { rawIdentifier: 'https://x.com/bob', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Bob', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    }
]);

console.log("✅ Created", statements.length, "statements");
console.log("   Statement Fide IDs:", statementFideIds.map(id => id?.slice(0, 25) + "...").join("\n                  "));
console.log("   Batch root:", root);
console.log();

// Example 3: Organization statement
console.log("3. Creating organization statement...");
const orgStatement = await createStatement({
    subject: { rawIdentifier: 'https://www.acme.com', entityType: 'Organization', sourceType: 'Product' },
    predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
    object: { rawIdentifier: 'Acme Corp', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
});

console.log("✅ Organization statement created");
console.log("   Statement Fide ID:", orgStatement.statementFideId?.slice(0, 30) + "...\n");

console.log("🎉 Statement building examples complete!");
console.log("\n💡 Key points:");
console.log("   - Always specify rawIdentifier, entityType, and sourceType");
console.log("   - Predicates must use canonical full URLs (https://...)");
