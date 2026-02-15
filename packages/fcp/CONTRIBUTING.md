# Contributing

## Naming Conventions

### Identifier casing

- Functions, variables, object properties: `camelCase`
- Types, interfaces, classes, enums: `PascalCase`
- Constants (module-level immutable values): `UPPER_SNAKE_CASE`

### Acronym style

Use standard JS/TS acronym casing in identifiers (`Id`, `Url`, `Eip712`, `Eip191`).

Exception: keep widely recognized format/protocol acronyms uppercase where that is clearer to developers (for example `JSON`, `JSONL`, `HTTP`, `URL`).

### Function naming

Prefer verb-first names:

- `calculateFideId`
- `parseFideId`
- `verifyAttestation`
- `createStatement`

Avoid noun-first function names unless constructor-like.

### Type naming

Prefer noun-based names, with qualifiers before the noun:

- `AttestationResult`
- `StatementInput`
- `FideEntityType`
- `FideStatementPredicateEntityType`

### Word order

Use specific-to-general order for fields:

- `subjectFideId`
- `predicateFideId`
- `attestationFideId`

Avoid flipped forms like `fideIdSubject`.

### Brand usage

Use `Fide` for protocol-specific code identifiers. Reserve `FCP` for package/org/repo naming and docs text.

Do not force brand terms into generic utilities:

- `createStatement` (not `createFideStatement` unless needed to disambiguate)
- `buildMerkleTree`

## Writing Style

- Prefer plain language over jargon.
- Define unavoidable protocol terms once, then use them consistently.
- Keep docs concise and concrete.

## Documentation Rules

These rules primarily apply to protocol docs under:
[`apps/docs/content/docs/(protocol)`](apps/docs/content/docs/(protocol))

- Use standard predicate namespaces (`schema:`, `prov:`, `sec:`, `owl:`). Do not introduce `fide:` predicates; `fide` is reserved for the DID prefix (`did:fide:`).
- In prose and examples, represent Fide IDs in DID form (`did:fide:0x...`). Use bare `0x...` only for raw cryptographic values or explicit pre-derivation inputs.
- Keep terminology consistent:
  - `Statement` for subject-predicate-object data
  - `Attestation` for signing event/credential
  - `EvaluationMethod` for evaluation method entity
- Keep docs DRY: link to the owning page/section instead of duplicating full explanations.
- Keep page scope focused (one page, one job): structure/semantics in schema docs, transport/verification/storage in lifecycle docs, workflow/policy in application docs.

## Consistency Policy

- New APIs should follow these rules.
- Existing mixed names should be normalized when touched, unless preserving a public API is required.
- If compatibility is required, use a migration/deprecation path before renaming exports.