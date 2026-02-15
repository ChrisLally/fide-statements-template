# Critique 22: The `did:fide:` Decision — Owning the Namespace

**Date**: 2026-02-07
**Decision**: Use `did:fide:` prefix universally for all Fide IDs
**Status**: 📋 Proposed

## The Proposal

Shift from raw hex Fide IDs (e.g., `0x15abc...`) to fully-qualified DIDs everywhere:

```
Before: 0x15abc123def...
After:  did:fide:0x15abc123def...
```

This applies to:
- All API responses (JSON-LD `@id` fields)
- All documentation examples
- All internal references (subject, predicate, object)
- All external URIs (when representing Fide entities)

## Why This Works

### 1. The "gRPC" Defense (Utility Wins)

The strongest precedent: **gRPC** (google Remote Procedure Call).

| Aspect | gRPC | FCP |
|--------|------|-----|
| **Branding** | Explicitly branded "google" | Explicitly branded "fide" |
| **Adoption** | Netflix, Uber, Square, Lyft | (TBD — you're early) |
| **Why it won** | Solved a real pain point (efficient microservices) | Solves a real pain point (context amnesia) |

**The lesson:** Developers respect opinionated tools from teams that eat their own dogfood. "This is how Fide builds trusted agents. We're sharing our internal standard." That implies battle-tested quality.

### 2. The "Latin Loophole" (Semantic Branding)

**Fide** = Latin for "trust" / "faith" / "fidelity"

This gives you a defense that gRPC and S3 never had:

> "Fide isn't just our company name; it describes what the protocol does. A Fide ID is a Trust ID. The `fide:` prefix indicates this identifier has been cryptographically verified for fidelity."

This transforms the brand from a manufacturer's label into a **quality descriptor**. When developers write `did:fide:0x15...`, they're invoking "trust" in Latin—whether they know it or not.

### 3. The "Kleenex" Effect (Namespace Capture)

If FCP wins, `did:fide:` becomes the generic term for distributed agent identity.

| Protocol | Namespace | Generic Term |
|----------|-----------|--------------|
| Amazon S3 | `s3://` | "S3-compatible storage" |
| FIDO Alliance | FIDO2 | "FIDO keys" / "passkeys" |
| **FCP** | `did:fide:` | "Fide IDs" |

By baking `fide:` into the URI scheme, you ensure:
- Even if governance moves to a foundation, the brand is immutable
- Every developer parsing an ID types your name
- Competitors must either extend your namespace or start from scratch

## Technical Implementation

### Current State

You already use `did:fide:` in two places:

1. **identifiers.mdx** (lines 217-219):
   ```
   Fide IDs can be used as DIDs via the `did:fide:` method:
   `did:fide:0x15...`
   ```

2. **query.mdx** (line 145):
   ```json
   { "@id": "did:fide:0x10..." }
   ```

### Proposed Changes

**Phase 1: Documentation Consistency**
- [ ] Update all examples in `/docs/fcp/` to use `did:fide:` prefix
- [ ] Standardize on `did:fide:0xXX...` format in all JSON-LD examples
- [ ] Update identifiers.mdx to make `did:fide:` the *primary* representation (not just W3C-compatible add-on)

**Phase 2: API Responses**
- [ ] All `@id` fields in JSON-LD responses include `did:fide:` prefix
- [ ] Entity resolution endpoints accept both `0x...` and `did:fide:0x...` (backward compatible)
- [ ] Internal storage remains raw hex (space-efficient)

**Phase 3: Developer Experience**
- [ ] Helper functions: `toDidFide(fideId)`, `fromDidFide(did)`
- [ ] Validation: `isValidFideId()` accepts both formats
- [ ] Display preference: always show `did:fide:` in UIs

## The Marketing Frame

**Weak Frame (avoid):**
> "We call it Fide Protocol, but it's open for everyone!"

**Strong Frame (use):**
> "The Fide Protocol is the standard for high-fidelity agent context. We built it because generic standards were too slow. The `fide:` prefix means this ID has been cryptographically verified."

You can distribute **governance** (create a "Fide Foundation" later) without changing the **name**. The namespace is permanent leverage.

## Addressing Concerns

### "Isn't this vendor lock-in?"

**No.** The protocol is Apache 2.0 licensed. Anyone can:
- Run their own FCP indexer
- Fork the protocol entirely
- Build competing implementations

The *name* is just a name. The *capability* is what matters. gRPC is open source despite being called "google RPC."

### "Won't enterprises reject branded protocols?"

**No.** Enterprises use:
- gRPC (Google)
- S3 (Amazon)
- GraphQL (Facebook)
- React (Facebook)
- Kubernetes (Google)

The pattern is clear: if it solves their problem, they use it.

### "Should we register the DID method formally?"

**Yes, eventually.** The W3C DID Methods Registry accepts community submissions. But:
1. Build adoption first
2. Register when you have usage to demonstrate
3. Don't wait for formal registration to use the namespace

## Conclusion

The `did:fide:` decision is not about ego—it's about **positioning**.

By owning the namespace:
1. You anchor your brand in the protocol's DNA
2. You benefit from the "Latin Loophole" (fide = trust)
3. You set up the Kleenex effect (Fide ID = generic term)
4. You signal confidence: "We built this. Use it if you want our quality."

**Recommendation:** Commit to `did:fide:` everywhere. Don't apologize for it. Own it.

---

## Implementation Checklist

### Documentation
- [ ] Update identifiers.mdx: make `did:fide:` the primary format
- [ ] Update all examples in schema/, entities.mdx, signing.mdx
- [ ] Update query.mdx examples to consistently use `did:fide:`
- [ ] Add "Why `did:fide:`?" section to index.mdx (optional FAQ)

### Code
- [ ] Add `toDidFide()` / `fromDidFide()` helper functions
- [ ] Update API responses to include `did:fide:` prefix
- [ ] Accept both formats in resolution endpoints
- [ ] Update seed scripts to generate `did:fide:` format in examples

### Marketing
- [ ] Prepare "Latin Loophole" messaging for objections
- [ ] Update README and landing page to emphasize `did:fide:`
- [ ] Consider registering `did:fide` with W3C DID Methods Registry (future)

---

## Related Critiques

- **Critique 19**: Genesis Statement identity derivation (how entities get `0x10...` IDs)
- **Critique 21**: Evaluation-based alias resolution (how aliases resolve via owl:sameAs)
- **Critique 22** (this): Namespace strategy (why `did:fide:` everywhere)

Together, these form the complete identity story:
```
External alias (did:fide:0x15...)
  ↓ owl:sameAs (evaluated)
Protocol-native primary (did:fide:0x10...)
  ↓ derived from
Genesis Statement (did:fide:0x00...)
  ↓ signed in
Attestation (did:fide:0xa0...)
```

Every step uses `did:fide:` — consistent, branded, defensible.

---

## Part 2: The Namespace-Free Philosophy (Predicates)

**Decision**: Retire all `fide:` predicates in favor of established standards (Schema.org, PROV-O, W3C Security).

**Rationale**:
Replacing proprietary predicates with established standards instantly matures your protocol. It shifts the perception of FCP from "Company Tool" to "Universal Glue."

### The Migration Map

| Current Predicate | Context | Replacement | Source Standard |
| --- | --- | --- | --- |
| **`fide:reasoning`** | Why an agent took an action | **`schema:rationale`** | **Schema.org** |
| **`fide:controls`** | Who owns a wallet/agent | **`sec:controller`** | **W3C Security Vocab** |
| **`fide:replaces`** | Correction / Versioning | **`prov:wasRevisionOf`** | **W3C PROV-O** |
| **`fide:previousStep`** | Workflow DAG sequencing | **`prov:wasInformedBy`** | **W3C PROV-O** |
| **`fide:evidence`** | Data backing a verdict | **`schema:citation`** | **Schema.org** |
| **`fide:signedAt`** | Signature Timestamp | **`prov:generatedAtTime`** | **W3C PROV-O** |

### Detailed Rationales

#### 1. `fide:reasoning` → `schema:rationale`
* **Why:** Exact semantic match. Allows agents to explain the "Why" behind a `schema:Action`.

#### 2. `fide:controls` → `sec:controller`
* **Why:** `controller` is the official term in the [W3C DID Specification](https://www.w3.org/TR/did-core/#verification-relationships). Aligning with the W3C security vocabulary (`https://w3id.org/security#controller`) is consistent with the move to DIDs.

#### 3. `fide:replaces` → `prov:wasRevisionOf`
* **Why:** PROV-O is the gold standard for lineage. It implies that the new Statement is the authoritative version of the old one.

#### 4. `fide:previousStep` → `prov:wasInformedBy`
* **Why:** Schema.org is weak on DAGs. PROV-O excels at them. Allows chaining actions (`Action B` `wasInformedBy` `Action A`) to create execution traces without inventing new terms.

### The Marketing Pitch
> "FCP doesn't force you to learn a new language. We use **Schema.org** for data, **PROV-O** for lineage, and **W3C DIDs** for identity. We just provide the **signatures** to make them trusted."

---

## Part 3: Standard Entity Alignment

**Decision**: Explicitly map every FCP Entity Type to its standard vocabulary equivalent in the documentation (`entities.mdx`).

**Rationale**:
Reinforces the "Universal Glue" philosophy. Developers intuitively understand `schema:Person` more than a proprietary `fide:Person`. It also aids in SEO for data discoverability.

### The Alignment Map

| FCP Entity | Standard Alignment | Notes |
| --- | --- | --- |
| **Person** | `schema:Person` | Direct Mapping |
| **Organization** | `schema:Organization` | Direct Mapping |
| **AutonomousAgent** | `prov:SoftwareAgent` | Better than `schema:SoftwareApplication` because it implies agency/action. |
| **Place** | `schema:Place` | Direct Mapping |
| **Event** | `schema:Event` | Direct Mapping |
| **Product** | `schema:Product` | Direct Mapping |
| **CreativeWork** | `schema:CreativeWork` | Direct Mapping |
| **CryptographicAccount** | `sec:Key` | From **W3C Security Vocab**. Represents a controlling keypair. |
| **Statement** | `rdf:Statement` | Conceptual alignment with RDF triples. |
| **Attestation** | `verifiable:VerifiableCredential` | Conceptually a VC, but lightweight. |

### Implementation Plan
-   Update `entities.mdx`.
-   Add an info `Callout` inside the accordion for each entity type:
    > **Standard Alignment**: This entity maps to `schema:Person`.
