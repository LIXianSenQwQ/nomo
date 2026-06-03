---
id: "{{FEATURE_ID}}"
kind: feature # [feature | epic | kr]
parent: "" # Required when kind=kr; the parent epic id. Leave empty otherwise.
status: pending # [pending | draft | in_progress | completed | archived]
impact_radius:
  - "<module-or-path-1>"
  - "<module-or-path-2>"
dependencies:
  - "none"
# Required ONLY when kind=epic. List the KR ids that compose this epic.
key_results:
  - "kr-01-<name>"
  - "kr-02-<name>"
---

# Specification: {{FEATURE_NAME}} (Specification)

> Remove sections that do not apply to this `kind`.
> - `kind: feature` → keep Scope + Functional Requirements; drop the Objective / Key Results sections.
> - `kind: epic` → keep Objective + Key Results; functional details belong inside each KR.
> - `kind: kr` → keep Key Result Statement + Scope + Functional Requirements.

## 0. Objective (Epic only)
*One-sentence Objective statement: the overall outcome this epic delivers. Include success metric.*

### Key Results
- **[kr-01-<name>](./krs/kr-01-<name>/spec.md)** — Target: ...
- **[kr-02-<name>](./krs/kr-02-<name>/spec.md)** — Target: ...

## 0. Key Result Statement (KR only)
*One-sentence measurable Key Result this spec delivers. Must be independently verifiable.*
- **Parent Epic**: [<epic-name>](../../spec.md)
- **Target Metric**: ...

## 1. Scope
*What are we building? (In Scope) What are we definitely not building? (Out of Scope)*
- **In Scope**: ...
- **Out of Scope**: ...

## 2. Functional Requirements

### ADDED
#### Requirement: [Requirement Name]
The system SHALL ...

##### Scenario: [Normal Case]
- **WHEN** [trigger condition]
- **THEN** [expected outcome]

##### Scenario: [Edge Case]
- **WHEN** [trigger condition]
- **THEN** [expected outcome]

#### Requirement: [Another Requirement Name]
The system SHALL ...

##### Scenario: [Case Name]
- **WHEN** [trigger condition]
- **THEN** [expected outcome]

### MODIFIED (if applicable)
#### Requirement: [Existing Requirement Name]
[Complete modified requirement with full context — cite which part changed and why]

##### Scenario: [Case Name]
- **WHEN** [trigger condition]
- **THEN** [expected outcome]

### REMOVED (if applicable)
#### Requirement: [Deprecated Requirement Name]
**Reason**: [Why removing]
**Migration**: [How existing usage is handled]