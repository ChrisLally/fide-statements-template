# Evaluation Method Rubric

Method ID: `temporal-validity/owl-sameAs/Person`  
Version: `v1`

## Goal
Evaluate whether `schema:validFrom` statements about the target `owl:sameAs` statement are accurate.

This means both must hold:
- the target `owl:sameAs` statement is true (`same`)
- the `schema:validFrom` time is accurate

Semantics:
- `schema:validFrom` here means real-world validity start for the `owl:sameAs` claim.
- Provenance/observation time (for example `prov:generatedAtTime`, `schema:dateCreated`) is separate.

Return one decision:
- `same`
- `uncertain`
- `different`

## Runtime Context

- target_sameas_statement_fide_id: {{target_sameas_statement_fide_id}}
- target_subject:
  - fide_id: {{target_subject_fide_id}}
  - entity_type_code: {{target_subject_entity_type_code}}
  - source_type_code: {{target_subject_source_type_code}}
  - entity_type: {{target_subject_entity_type}}
  - source_type: {{target_subject_source_type}}
  - fingerprint: {{target_subject_fingerprint}}
  - raw_identifier: {{target_subject_raw_identifier}}
- target_object:
  - fide_id: {{target_object_fide_id}}
  - entity_type_code: {{target_object_entity_type_code}}
  - source_type_code: {{target_object_source_type_code}}
  - entity_type: {{target_object_entity_type}}
  - source_type: {{target_object_source_type}}
  - fingerprint: {{target_object_fingerprint}}
  - raw_identifier: {{target_object_raw_identifier}}

## Rubric

1. Objective checks
- `citation_chain`: each `schema:validFrom` statement should have direct `prov:hadPrimarySource`.
- `explicit_contradiction`: explicit `owl:differentFrom` for the same pair is strong negative evidence.
- temporal consistency: `validThrough` earlier than `validFrom` is invalid.

### Objective Evidence (Injected)

#### validFrom
{{objective_valid_from_section_md}}

#### validThrough
{{objective_valid_through_section_md}}

#### citationsByValidFrom
{{objective_citations_by_valid_from_section_md}}

#### explicitContradictions
{{objective_explicit_contradictions_section_md}}

2. Heuristic checks
- `name_alignment`: overlapping normalized `schema:name` values is strong positive evidence.
- `affiliation_overlap`: overlapping affiliation targets is positive evidence.

### Heuristic Evidence (Injected)

#### names
{{heuristic_names_section_md}}

#### affiliations
{{heuristic_affiliations_section_md}}

3. Decision guidance
- `same`: evidence supports both identity equivalence and validFrom timestamp accuracy.
- `different`: evidence shows equivalence is false, or validFrom timing is incorrect.
- `uncertain`: evidence is incomplete, conflicting, or not strong enough on either identity or timing.
- If explicit contradiction is decisive, return `different`.
- If citation chain is complete and identity and timing signals are strong, return `same`.
- Otherwise return `uncertain`.

## Output Contract (JSON only)

Return a single JSON object:

```json
{
  "targetSameAsStatementFideId": "string",
  "decision": "same | uncertain | different",
  "score": 0.0,
  "confidence": 0.0,
  "reviewRequired": true,
  "reason": "short explanation",
  "evidenceStatementFideIds": ["did:fide:0x..."]
}
```

## Constraints

- Do not invent evidence that is not present in runtime inputs.
- Prefer `uncertain` when signals conflict or evidence is sparse.
- Keep reasoning concise and grounded in provided statements.
