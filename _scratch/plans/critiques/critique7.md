# Critique 7: Well-Known Entity Standardization

## Problem Statement

Currently, FCP has clear derivation patterns for:
- **Signing keys**: Ethereum address derivation (deterministic)
- **Predicates**: `keccak256("fcp:predicate:" + canonicalName)` (deterministic)
- **Claims**: `keccak256(signature)` (deterministic)
- **Schemas**: `keccak256(eip712TypeString)` (deterministic)

But for "real-world" entities like languages, countries, currencies, and places, we fall back to **UUID-based derivation**. This creates fragmentation:

```
Agent A: Creates "English" with UUID abc123 → 0x7f3a...
Agent B: Creates "English" with UUID def456 → 0x9b2c...
Result: Two entities that should be the same are different.
```

**The more entities we can standardize, the more powerful the graph becomes.**

---

## Proposal: Well-Known Entity Derivation

**"Well-Known Entities"** are entities derived from **external standards** (not FCP-defined). They use the standard's own namespace, not `fcp:`.

### Derivation Pattern

For entities that have internationally recognized standard identifiers, derive the Fide ID from:

```
keccak256("<standard-prefix>:<standard-value>")
```

Where `<standard-prefix>` is the external standard's identifier (e.g., `iso-639-3`, `spdx`).

### Examples

| Entity | Standard | Canonical String | Fide ID |
|--------|----------|-----------------|---------|
| English | ISO 639-3 | `iso-639-3:eng` | `0x` + last20(keccak256("iso-639-3:eng")) |
| United States | ISO 3166-1 alpha-2 | `iso-3166-1-alpha2:US` | `0x` + last20(keccak256("iso-3166-1-alpha2:US")) |
| US Dollar | ISO 4217 | `iso-4217:USD` | `0x` + last20(keccak256("iso-4217:USD")) |
| JSON MIME | IANA | `iana-mime:application/json` | `0x` + last20(keccak256("iana-mime:application/json")) |
| MIT License | SPDX | `spdx:MIT` | `0x` + last20(keccak256("spdx:MIT")) |

---

## Why Standard-First Instead of FCP-First?

### Option A: FCP-namespaced (rejected)
```
fcp:lang:en
fcp:country:US
fcp:currency:USD
```

- **Pro**: Consistent `fcp:` prefix
- **Con**: Obscures the actual standard being used
- **Con**: What if ISO 639-1 and ISO 639-3 both have values? Ambiguous.

### Option B: Standard-namespaced (proposed)
```
iso-639-3:eng
iso-3166-1-alpha2:US
iso-4217:USD
```

- **Pro**: Clear provenance — you know exactly which standard
- **Pro**: Handles version/variant differences (639-1 vs 639-3)
- **Pro**: Self-documenting — anyone can look up the standard
- **Con**: More prefixes to remember

**Decision: Standard-first is more honest and future-proof.**

---

## Proposed Standard Prefixes

### Tier 1: High Priority (Suggested Defaults)

Always prefer standards with **complete coverage**.

| Standard | Prefix | Entity Type | Coverage | Suggested? |
|----------|--------|-------------|----------|------------|
| **ISO 639-3** | `iso-639-3:` | `creative_work` | 3-letter codes, ~7,800 languages | ✅ Yes |
| **ISO 639-1** | `iso-639-1:` | `creative_work` | 2-letter codes, ~184 major languages | Use 639-3 instead |
| **ISO 3166-1 alpha-2** | `iso-3166-1-alpha2:` | `place` | 2-letter country codes (US, GB, JP), 249 countries | ✅ Yes |
| **ISO 3166-1 alpha-3** | `iso-3166-1-alpha3:` | `place` | 3-letter country codes (USA, GBR), 249 countries | Same coverage as alpha-2 |
| **ISO 3166-2** | `iso-3166-2:` | `place` | Country subdivisions (US-CA, JP-13) | ✅ Yes |
| **ISO 4217** | `iso-4217:` | `creative_work` | Currency codes (USD, EUR, BTC) | ✅ Yes |
| **IANA Timezones** | `iana-tz:` | `creative_work` | Timezone identifiers (America/New_York) | ✅ Yes |

### Tier 2: Useful Extensions

| Standard | Prefix | Entity Type | Coverage |
|----------|--------|-------------|----------|
| **CAIP-19** | `caip-19:` | `product` | Blockchain assets (preferred for crypto) |
| **IANA MIME Types** | `iana-mime:` | `creative_work` | File/content types |
| **SPDX Licenses** | `spdx:` | `creative_work` | Open source licenses |
| **UN/LOCODE** | `un-locode:` | `place` | Cities and ports (USNYC) |
| **IETF BCP 47** | `bcp-47:` | `creative_work` | Full language tags (en-US) |

> **Note on Crypto**: Use CAIP-19 for blockchain assets, not ISO-4217. ISO-4217 has limited crypto coverage and isn't designed for on-chain assets. Example: `caip-19:eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` (USDC on Ethereum).

### Tier 3: Domain-Specific

| Standard | Prefix | Entity Type | Coverage |
|----------|--------|-------------|----------|
| **ISIN** | `isin:` | `product` | Securities identifiers |
| **ISBN** | `isbn:` | `creative_work` | Books |
| **DOI** | `doi:` | `creative_work` | Academic papers |
| **ORCID** | `orcid:` | `person` | Researcher identifiers |
| **LEI** | `lei:` | `organization` | Legal Entity Identifiers |
| **EIN** | `ein:` | `organization` | US company tax IDs |
| **DUNS** | `duns:` | `organization` | D&B business numbers |

---

## Entity Type Assignments

### Languages → `creative_work`

A language definition is a specification — a creative work that defines vocabulary and grammar.

```
Entity: iso-639-3:eng
Type: creative_work
Name: "English"
```

**Note**: A *spoken dialect* or *regional variant* might be linked via relationship:
```
bcp-47:en-US --[fcp:rel:variantOf]--> iso-639-3:eng
```

### Countries/Places → `place`

Geographic entities with recognized borders.

```
Entity: iso-3166-1-alpha2:US
Type: place
Name: "United States of America"
```

Subdivisions link to parent:
```
iso-3166-2:US-CA --[fcp:rel:partOf]--> iso-3166-1-alpha2:US
```

### Currencies → `creative_work`

A currency is an abstract specification, not a physical thing.

```
Entity: iso-4217:USD
Type: creative_work
Name: "United States Dollar"
```

**Note**: *Cryptocurrency* derivation is interesting. We could use:
- `iso-4217:BTC` (if ISO recognizes it)
- `caip-19:eip155:1/erc20:0xa0b8...` (CAIP standard for blockchain assets)

### Licenses → `creative_work`

Legal documents defining terms of use.

```
Entity: spdx:MIT
Type: creative_work
Name: "MIT License"
```

---

## When NOT to Use Standard Derivation

Standard derivation only works when:
1. **The standard is stable** — the code won't be reassigned
2. **The standard is authoritative** — widely recognized
3. **The mapping is 1:1** — one code = one real-world thing

### Anti-Patterns

| Case | Problem | Solution |
|------|---------|----------|
| Email addresses | Domains change hands | UUID |
| Social handles | Accounts get renamed | UUID |
| URLs | Pages move/disappear | UUID |
| Phone numbers | Numbers get reassigned | UUID |
| Product SKUs | Vendor-specific, not universal | UUID |

---

## Content Hashing for Creative Works

### Why NOT Hash Content for Entity IDs?

You might ask: "Can we derive `creative_work` FideIds from content hashes, like Git does for files?"

**Answer: No, not by default.**

The problem is **reputation severing**:
1. You write a brilliant article → ID `0xA` → accumulates 100 positive evaluations
2. You fix a typo → content changes → new hash → ID becomes `0xB`
3. Result: `0xB` has **zero history and zero trust**

Most creative works are "living documents" where identity should persist through edits.

### Where FCP Already Uses Content-Hashing

FCP uses content-derived IDs only where **immutability IS the identity**:

| Entity | Derivation | Rationale |
|--------|-----------|-----------|
| Schema | `keccak256(typeString)` | A schema IS its definition |
| Claim | `keccak256(signature)` | Immutable signed statement |
| Predicate | `keccak256("fcp:predicate:" + name)` | Protocol constants |

### The Right Pattern: Stable ID + Hash Attributes

For content verification, use **stable entity IDs** with **hash attributes**:

```
Entity: <uuid-derived-fide-id>  ← stable identity
Attributes:
  fcp:attr:hash:sha256 = "abc123..."  ← content snapshot
  fcp:attr:hash:cid = "QmXyz..."      ← self-describing multihash
```

**Predicate pattern**: `fcp:attr:hash:<algorithm>`

| Predicate | Value Format |
|-----------|--------------|
| `fcp:attr:hash:sha1` | 40-char hex |
| `fcp:attr:hash:sha256` | 64-char hex |
| `fcp:attr:hash:sha512` | 128-char hex |
| `fcp:attr:hash:keccak256` | 64-char hex |
| `fcp:attr:hash:cid` | CID (self-describing, includes algorithm) |

### Versioning via Claim History

When content changes, create a new claim with `claimReplaces`:
- Entity identity = UUID (stable)
- Content snapshots = `fcp:attr:hash:*` attributes with temporal validity
- Claim history = version history

No need for separate "version entities" — the claim chain IS the version history.

---

## Platform-Scoped Predicates (External IDs)

For linking entities to their identifiers on external platforms (Twitter handles, GitHub usernames, etc.), we use **platform-scoped predicates** rather than hardcoding platform names.

### The Problem

Hardcoding platform names into predicates is brittle:
```
❌ fcp:attr:external-id:twitter → "elonmusk"
```
- What happens when Twitter becomes X?
- FCP would need to maintain a registry of all platforms

### The Solution

The `attributeType` is a predicate entity derived from the **platform's FideId**:

```
✅ attributeType: <twitter-slug-predicate-fide-id>
   attributeValue: "elonmusk"
```

Where the predicate FideId is derived from:
```
keccak256("attr:slug:" + <platform-fide-id>)
```

### How It Works

1. **Platform entities** (Twitter, GitHub, LinkedIn) are `product` type entities with UUID-derived FideIds
2. **Fide bootstraps** the canonical FideIds for major social platforms
3. **Platform-scoped predicates** are derived from the platform's FideId:
   - `attr:id:<platform-fide-id>` → User ID (numeric, immutable)
   - `attr:slug:<platform-fide-id>` → Handle/username (mutable, human-readable)
   - `attr:url:<platform-fide-id>` → Profile URL

### Example: Alice's Twitter Handle

```
subjectFideId: <alice-fide-id>
attributeType: <predicate-derived-from-twitter-fide-id>
attributeValue: "alice"
```

### Why This Is Better

| Benefit | Explanation |
|---------|-------------|
| **No platform registry in FCP** | Platforms define their own predicates |
| **Extends to any platform** | New platform → new predicate entity |
| **Queryable** | Find all entities with a handle on Twitter |
| **Rebrand-proof** | Twitter→X doesn't break anything (same FideId) |

### Bootstrap: Fide-Seeded Platforms

Fide (the protocol creator) will publish canonical FideIds for major platforms to bootstrap the ecosystem:
- Twitter/X
- LinkedIn
- GitHub
- Discord
- Telegram
- etc.

The community trusts these because Fide is the protocol creator. New platforms get added as the ecosystem grows. Duplicates are resolved via `fcp:rel:sameAs` equivalence claims.

---

## Relationship to FCP Predicates

**Key distinction:**
- **`fcp:`** = FCP-defined protocol vocabulary (predicates, action types, policies)
- **Everything else** = Well-Known Entities from external standards

FCP predicates (`fcp:attr:*`, `fcp:rel:*`, etc.) remain FCP-namespaced because:
1. They are **protocol-defined vocabulary**, not external standards
2. They need to be consistent across all FCP implementations
3. There is no external authority defining them

Well-Known Entities use **external standard prefixes** because:
1. An authoritative body (ISO, IANA, SPDX) defines them
2. The codes are globally recognized
3. FCP should not "re-namespace" existing standards

This creates a clean separation:
```
fcp:attr:language   → The FCP predicate for "language attribute"
iso-639-3:eng       → The Well-Known Entity representing English
```

A claim might say:
```
Subject: <some-book>
Predicate: fcp:attr:language
Object: iso-639-3:eng
```

---

## Documentation Updates Needed

### 1. Update `/docs/fcp/entities/identity`

Add new section: **"Well-Known Entity Derivation"**
- Explain standard-prefixed derivation
- List Tier 1 standards
- Provide derivation function

### 2. Create `/docs/fcp/entities/well-known`

New page with:
- Full table of supported standards
- Entity type assignments
- Examples for each standard
- Lookup tools / reference links

### 3. Update `/docs/fcp/entities/types`

Add note under each type about standard derivation options:
- `place`: ISO 3166, UN/LOCODE
- `creative_work`: ISO 639, SPDX, DOI
- etc.

---

## Design Decisions

### 1. Case Sensitivity

Use the **canonical form** defined by each standard. Values MUST match exactly to avoid fragmentation.

| Standard | Canonical Form | Correct | Wrong |
|----------|---------------|---------|-------|
| ISO 3166-1 alpha-2 | Uppercase | `US` | `us` |
| ISO 3166-1 alpha-3 | Uppercase | `USA` | `usa` |
| ISO 639-3 | Lowercase | `eng` | `ENG` |
| ISO 4217 | Uppercase | `USD` | `usd` |
| SPDX | As published | `MIT`, `Apache-2.0` | `mit` |
| CAIP-19 | As specified | `eip155:1` | — |
| IANA Timezones | As published | `America/New_York` | — |

### 2. Version Handling
The derivation is from the code, not the version. New codes create new entities.

### 3. Deprecated Codes
Old claims remain valid. New claims should use current codes.

### 4. Remove `fcp:rel:trust`

The predicate `fcp:rel:trust` should be **removed** from the protocol.

**Why it's wrong:**
- Trust is **emergent** from the graph (evaluations, verdict accuracy, behavior over time) — not something you declare
- "I trust you" is **meaningless without context** — trust for what?
- It's **gameable** — sybils can declare trust in each other
- It's **redundant** — FCP has the evaluation system (`FideEvaluation`) for trust signals

**How trust actually works in FCP:**
- Applications configure which evaluators/methodologies they weight
- Trust propagates through the evaluation graph, not relationship declarations
- An entity's reputation comes from accumulated evaluations over time

If someone wants to express domain-specific trust ("I trust Alice's AI safety evaluations"), they configure their local trust weights at the application layer — not by creating a relationship claim.

---

## Summary

| Derivation Category | Pattern | Example |
|--------------------|---------|---------|
| Signing Keys | `keccak256(publicKey)` | Ethereum address |
| FCP Predicates | `keccak256("fcp:predicate:" + name)` | `fcp:attr:type` |
| Well-Known Entities | `keccak256("<standard>:<value>")` | `iso-639-3:eng` |
| Claims | `keccak256(signature)` | — |
| Schemas | `keccak256(eip712TypeString)` | — |
| Emergent Entities | `keccak256(uuid)` | People, orgs, products |

The more we can move entities from "Emergent" to "Well-Known", the more interconnected and useful the Fide Context Graph becomes.
