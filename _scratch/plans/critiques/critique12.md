# FCP Documentation Critique: critique12 (Standardization & Cleanup)

*Status: **READY FOR IMPLEMENTATION***
*Last Updated: 2026-01-25*

---

## Executive Summary

The documentation now reflects the **Pure Triple Model** and standard vocabularies. The codebase is currently out of sync with these new standards. This document serves as the **Implementation Plan** to synchronize the code, SQL schemas, and seed data.

---

## 1. Codebase Synchronization Plan

We will execute the following updates in order.

### 1.1 Type Definitions (`fide/content/docs/fcp/schema/schemas.ts`)
*   **Action:** Ensure `FideStatement` reflects the "Pure Triple" structure (Subject, Predicate, Object).
*   **Action:** Update types to support strictly typed URNs.

### 1.2 Database Schema (`fide/scripts/supabase/manual-migrations/`)
The database must support the storing of full URNs and optimized indexing for the new vocabulary strategy.

*   **`fcp-indexer-supabase.sql`**:
    *   **Goal:** Ensure tables (`fcp_statements`, `fcp_attestations`) are compatible with 3-Part URNs (Text columns are fine, but ensure check constraints if any).
    *   **Action:** Review for any legacy constraints.
    
*   **`fcp-indexer-views.sql`**:
    *   **Goal:** Update ALL views to use the new Standard Vocabularies.
    *   **Specific Updates:**
        *   `fcp_view_entity_types`: `schema:type` (Confirm casing/URN).
        *   `fcp_view_entity_names`: `schema:name` (was just `'name'`).
        *   `fcp_view_control_relationships`: `fide:controls` (was `'control'`).
        *   `fcp_view_sameas_relationships`: `owl:sameAs` (was `'sameAs'`).
        *   `fcp_view_evidence_links`: `fide:evidence` / `schema:citation` (Review predicate).
        *   `fcp_view_entity_evaluations`: `schema:reviewRating`.
        *   `fcp_view_action_steps`: `schema:agent`, `schema:actionStatus`, `schema:result`.

### 1.3 Seeding Script (`fide/scripts/fcp/seed-test-claims.ts`)
This script is the "Ground Truth" for generating valid test data. It must use the new vocabularies.

*   **Predicates:** Update all constants to full URNs.
    *   `PREDICATE_WORKS_FOR` -> `schema:worksFor`
    *   `PREDICATE_KNOWS` -> `schema:knows`
    *   `PREDICATE_CONTROL` -> `fide:controls`
    *   `PREDICATE_SAME_AS` -> `owl:sameAs` (or `schema:sameAs` if loose) context-dependent.
*   **IDs:** Ensure `calculateFideId` generates IDs based on the 3-Part URN logic (Namespace:Type:Value).

### 1.4 Indexer Logic (`fide/lib/fcp/indexer/`)
*   **`materialize.ts`**: Ensure it handles the extraction of these full predicates correctly without stripping prefixes unless intended.
*   **`verify.ts`**: Ensure signature verification respects the new structure.

---

## 2. Action Items (Copy-Paste Ready)

### Step 1: Update SQL Views
Update `fcp-indexer-views.sql` to map the new predicates.
```sql
-- Example Change
-- BEFORE: WHERE s.predicate = 'control'
-- AFTER:  WHERE s.predicate = 'fide:controls'
```

### Step 2: Update Seed Script
Update `seed-test-claims.ts` to use "Tiered Vocabulary" prefixes.
```typescript
// BEFORE
const PREDICATE_CONTROL = 'control';
// AFTER
const PREDICATE_CONTROL = 'fide:controls';
```

### Step 3: Run Database Reset
1.  Run `fcp-indexer-supabase.sql` (Recreate tables)
2.  Run `fcp-indexer-views.sql` (Recreate views)
3.  Run `seed-test-claims.ts` (Populate with new standard data)

---

## 3. Open Questions (Resolved)

*   **"Fact" vs "Statement"**: Resolved. We use **Statement**.
*   **Vocabularies**: Resolved. Tiered approach (Schema.org > FCP > OWL/SKOS).

**Status: Ready to Execute Phase 2 (Code Sync).**
