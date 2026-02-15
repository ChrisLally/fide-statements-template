import {
    SCHEMA_PREDICATES,
    PROV_PREDICATES,
    OWL_PREDICATES,
    SEC_PREDICATES,
    expandPredicateIdentifier,
    calculateFideId
} from "../../dist/index.js";

console.log("📚 Testing Schema & Predicate Helpers\n");

let failures = 0;
let checks = 0;

// Test 1: Schema predicates constants
console.log("1. Testing SCHEMA_PREDICATES constants...");
checks += 1;
try {
    if (!SCHEMA_PREDICATES.name || !SCHEMA_PREDICATES.worksFor ||
        !SCHEMA_PREDICATES.description || !SCHEMA_PREDICATES.sameAs) {
        failures += 1;
        console.error("  ❌ Missing schema predicate constants");
    } else if (!SCHEMA_PREDICATES.name.startsWith('schema:')) {
        failures += 1;
        console.error("  ❌ Invalid schema predicate format");
    } else {
        console.log("  ✅ Schema predicates available");
        console.log("     name:", SCHEMA_PREDICATES.name);
        console.log("     worksFor:", SCHEMA_PREDICATES.worksFor);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 2: PROV predicates constants
console.log("\n2. Testing PROV_PREDICATES constants...");
checks += 1;
try {
    if (!PROV_PREDICATES.wasGeneratedBy || !PROV_PREDICATES.wasDerivedFrom) {
        failures += 1;
        console.error("  ❌ Missing PROV predicate constants");
    } else if (!PROV_PREDICATES.wasGeneratedBy.startsWith('prov:')) {
        failures += 1;
        console.error("  ❌ Invalid PROV predicate format");
    } else {
        console.log("  ✅ PROV predicates available");
        console.log("     wasGeneratedBy:", PROV_PREDICATES.wasGeneratedBy);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 3: OWL predicates constants
console.log("\n3. Testing OWL_PREDICATES constants...");
checks += 1;
try {
    if (!OWL_PREDICATES.sameAs || !OWL_PREDICATES.differentFrom) {
        failures += 1;
        console.error("  ❌ Missing OWL predicate constants");
    } else if (!OWL_PREDICATES.sameAs.startsWith('owl:')) {
        failures += 1;
        console.error("  ❌ Invalid OWL predicate format");
    } else {
        console.log("  ✅ OWL predicates available");
        console.log("     sameAs:", OWL_PREDICATES.sameAs);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 4: Security predicates constants
console.log("\n4. Testing SEC_PREDICATES constants...");
checks += 1;
try {
    if (!SEC_PREDICATES.controller || !SEC_PREDICATES.owner) {
        failures += 1;
        console.error("  ❌ Missing security predicate constants");
    } else if (!SEC_PREDICATES.controller.startsWith('sec:')) {
        failures += 1;
        console.error("  ❌ Invalid security predicate format");
    } else {
        console.log("  ✅ Security predicates available");
        console.log("     controller:", SEC_PREDICATES.controller);
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 5: expandPredicateIdentifier
console.log("\n5. Testing expandPredicateIdentifier...");
checks += 1;
try {
    if (expandPredicateIdentifier("schema:name") !== "https://schema.org/name") {
        failures += 1;
        console.error("  ❌ schema:name expansion wrong");
    } else if (expandPredicateIdentifier("owl:sameAs") !== "https://www.w3.org/2002/07/owl#sameAs") {
        failures += 1;
        console.error("  ❌ owl:sameAs expansion wrong");
    } else if (expandPredicateIdentifier("https://schema.org/name") !== "https://schema.org/name") {
        failures += 1;
        console.error("  ❌ Full URL pass-through wrong");
    } else {
        console.log("  ✅ expandPredicateIdentifier works");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 6: explicit predicate Fide ID calculation
console.log("\n6. Testing explicit predicate Fide ID calculation...");
checks += 1;
try {
    const predicate = SCHEMA_PREDICATES.name;
    const predicateFideId = await calculateFideId('CreativeWork', 'Product', expandPredicateIdentifier(predicate));
    
    const expanded = expandPredicateIdentifier(predicate);
    const expectedFideId = await calculateFideId('CreativeWork', 'Product', expanded);
    
    if (predicateFideId !== expectedFideId) {
        failures += 1;
        console.error("  ❌ Predicate Fide ID doesn't match manual calculation");
    } else if (!predicateFideId.startsWith('did:fide:0x65')) {
        failures += 1;
        console.error("  ❌ Predicate must be 0x65 (CreativeWork+Product), got:", predicateFideId.slice(0, 14));
    } else {
        console.log("  ✅ Calculated predicate Fide ID");
        console.log("     Predicate:", predicate);
        console.log("     Fide ID:", predicateFideId.slice(0, 30) + "...");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

// Test 7: explicit predicate Fide ID calculation with PROV predicate
console.log("\n7. Testing predicate Fide ID with PROV predicate...");
checks += 1;
try {
    const predicate = PROV_PREDICATES.wasGeneratedBy;
    const predicateFideId = await calculateFideId('CreativeWork', 'Product', expandPredicateIdentifier(predicate));
    
    if (!predicateFideId.startsWith('did:fide:0x')) {
        failures += 1;
        console.error("  ❌ Invalid Fide ID format");
    } else {
        console.log("  ✅ Calculated PROV predicate Fide ID");
    }
} catch (error) {
    failures += 1;
    console.error("  ❌ Error:", error.message);
}

if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) failed`);
    process.exit(1);
}

console.log(`\n✅ All ${checks} schema/predicate tests passed`);
