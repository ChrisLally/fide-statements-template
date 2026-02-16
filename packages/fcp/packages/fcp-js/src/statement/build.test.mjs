import {
    createStatement,
    createStatementFromParts,
    buildStatementBatchWithRoot
} from "../../dist/index.js";

console.log("📝 Testing Statement Building Helpers\n");

let failures = 0;
let checks = 0;

// Test 1: Create statement
console.log("1. Testing createStatement...");
checks += 1;
try {
    const statement = await createStatement({
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    });

    if (!statement.subjectFideId || !statement.subjectRawIdentifier ||
        !statement.predicateFideId || !statement.predicateRawIdentifier ||
        !statement.objectFideId || !statement.objectRawIdentifier ||
        !statement.statementFideId) {
        failures += 1;
        console.error("  ❌ Missing required fields");
    } else if (!statement.subjectFideId.startsWith('did:fide:0x') ||
        !statement.predicateFideId.startsWith('did:fide:0x') ||
        !statement.objectFideId.startsWith('did:fide:0x') ||
        !statement.statementFideId.startsWith('did:fide:0x')) {
        failures += 1;
        console.error("  ❌ Invalid Fide ID format");
    } else {
        console.log("  ✅ Statement created successfully");
        console.log("     Subject Fide ID:", statement.subjectFideId.slice(0, 30) + "...");
        console.log("     Statement Fide ID:", statement.statementFideId.slice(0, 30) + "...");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 2: Build statement batch with root
console.log("\n2. Testing buildStatementBatchWithRoot...");
checks += 1;
try {
    const { statements, statementFideIds, root } = await buildStatementBatchWithRoot([
        {
            subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
            predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
            object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
        },
        {
            subject: { rawIdentifier: 'https://x.com/bob', entityType: 'Person', sourceType: 'Product' },
            predicate: { rawIdentifier: 'https://schema.org/worksFor', entityType: 'CreativeWork', sourceType: 'Product' },
            object: { rawIdentifier: 'https://www.acme.com', entityType: 'Organization', sourceType: 'Product' }
        }
    ]);

    if (statements.length !== 2) {
        failures += 1;
        console.error("  ❌ Expected 2 statements, got", statements.length);
    } else if (!statements[0].statementFideId || !statements[1].statementFideId) {
        failures += 1;
        console.error("  ❌ Missing statement Fide IDs");
    } else if (statementFideIds.length !== 2 || !root) {
        failures += 1;
        console.error("  ❌ Missing statement batch IDs or root");
    } else {
        console.log("  ✅ Created batch of", statements.length, "statements with root");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 3: createStatementFromParts parity with createStatement
console.log("\n3. Testing createStatementFromParts parity...");
checks += 1;
try {
    const fromObject = await createStatement({
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    });
    const fromParts = await createStatementFromParts(
        'https://x.com/alice',
        'Person',
        'Product',
        'https://schema.org/name',
        'CreativeWork',
        'Product',
        'Alice',
        'CreativeWork',
        'CreativeWork'
    );

    if (fromObject.statementFideId !== fromParts.statementFideId) {
        failures += 1;
        console.error("  ❌ createStatementFromParts produced different statement ID");
    } else {
        console.log("  ✅ createStatementFromParts matches createStatement");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 4: Reject Person+Statement (0xX0 forbidden)
console.log("\n4. Testing rejection of Person+Statement...");
checks += 1;
try {
    await createStatement({
        subject: {
            rawIdentifier: "https://x.com/alice",
            entityType: "Person",
            sourceType: "Statement"
        },
        predicate: { rawIdentifier: "https://schema.org/name", entityType: "CreativeWork", sourceType: "Product" },
        object: { rawIdentifier: "Alice", entityType: "CreativeWork", sourceType: "CreativeWork" }
    });
    failures += 1;
    console.error("  ❌ Should have rejected Person+Statement");
} catch (error) {
    if (error.message.includes("disallows") || error.message.includes("Statement source")) {
        console.log("  ✅ Correctly rejected Person+Statement");
    } else {
        failures += 1;
        console.error("  ❌ Wrong error:", error.message);
    }
}

// Test 5: Error when subject/object are malformed (missing entityType/sourceType)
console.log("\n5. Testing error when subject is malformed...");
checks += 1;
try {
    await createStatement({
        subject: { rawIdentifier: 'https://x.com/alice' }, // Missing entityType, sourceType
        predicate: { rawIdentifier: 'https://schema.org/name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    });
    failures += 1;
    console.error("  ❌ Should have thrown for malformed subject");
} catch (error) {
    if (error.message?.includes('entityType') || error.message?.includes('sourceEntityType')) {
        console.log("  ✅ Correctly rejected malformed subject");
    } else {
        failures += 1;
        console.error("  ❌ Wrong error:", error.message);
    }
}

// Test 6: Reject predicate shorthand (must be canonical URL)
console.log("\n6. Testing rejection of predicate shorthand...");
checks += 1;
try {
    await createStatement({
        subject: { rawIdentifier: 'https://x.com/alice', entityType: 'Person', sourceType: 'Product' },
        predicate: { rawIdentifier: 'schema:name', entityType: 'CreativeWork', sourceType: 'Product' },
        object: { rawIdentifier: 'Alice', entityType: 'CreativeWork', sourceType: 'CreativeWork' }
    });
    failures += 1;
    console.error("  ❌ Should have rejected shorthand predicate");
} catch (error) {
    if (error.message?.includes('canonical full URL')) {
        console.log("  ✅ Correctly rejected shorthand predicate");
    } else {
        failures += 1;
        console.error("  ❌ Wrong error:", error.message);
    }
}

if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) failed`);
    process.exit(1);
}

console.log(`\n✅ All ${checks} statement building tests passed`);
