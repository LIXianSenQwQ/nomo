---
name: "smart-requirement-workflow"
description: "Interrogates user to clarify vague requirements, then generates SDD specs, guides implementation, and verifies completion. Full lifecycle from requirement gathering to verified delivery. Invoke when adding, modifying, or implementing requirements."
version: "2.0.0"
author: "tianyu0919"
tags:
  - requirements
  - sdd
  - specification
  - project-management
  - documentation
  - kanban
  - dashboard
  - implementation
  - verification
category: "project-management"
---

# Smart Requirement Workflow

This skill combines rigorous requirement gathering (the "Grill") with specification generation, implementation guidance, and verification — all managed under the `sdd` folder. It ensures that vague or incomplete user requirements are fully clarified before any specification document is written, and that implementation stays on track through to verified completion.

## When to Use This Skill

Use this skill when the user:
- Proposes a new requirement or feature.
- Asks to add a new requirement.
- Asks to modify or update an existing requirement **with non-trivial scope** (multi-file, cross-module, behavior changes, or impacting public interfaces).
- Wants to implement a previously specified requirement.

## When NOT to Use This Skill

Skip this skill when the change is small and self-contained, such as:
- A single-file refactor with no behavior change.
- A localized bug fix that does not alter contracts or interfaces.
- Cosmetic edits (typos, comments, formatting).
- Trivial config tweaks.

**Rule of thumb**: judge by **scope and impact radius**, not by "new vs. modify". A modification that touches multiple modules, changes data models, breaks compatibility, or carries non-trivial design decisions still requires the full workflow.

## Prerequisites

Before invoking this skill, ensure:

- **Project root is writable**: the skill creates and updates files under `sdd/` (e.g., `sdd/specs/<name>/`, `sdd/project.md`). The agent must have file-write permission.
- **Codebase is searchable**: Phase 1 mandates Context Gathering via search/grep tools. The project should be indexable (no overly large binary directories blocking search).
- **Templates are present**: `references/proposal.template.md`, `design.template.md`, `spec.template.md`, `tasks.template.md`, `checklist.template.md` must exist alongside this SKILL.md.
- **Optional — Dashboard**: Node.js 14+ is required only if the user asks to launch the kanban dashboard via `scripts/dashboard.js` (port 3030 must be free).
- **User availability**: this skill is interactive and **cannot run unattended**. Phases 1, 2, 3 (Step 8), and E1–E5 all require user input. Do not invoke in headless/CI contexts.

## Workflow

### Phase 1: Interrogation (The "Grill")

#### Quick Path (Optional Shortcut)

If the user provides **all** of the following, you MAY skip the deep interrogation and proceed directly to Phase 2:
- Clear functional scope (what the system should do)
- Known user roles and primary user flows
- Defined acceptance criteria or expected outcomes
- No cross-module impacts or ambiguous edge cases

**How to check**: After context gathering (step 2 below), assess if the requirement is sufficiently detailed. If yes, briefly summarize the requirement and ask: *"This seems well-defined. Should I proceed directly to spec generation, or would you like me to dig deeper into edge cases?"*

If the user wants thoroughness, continue with the full interrogation below.

#### Full Interrogation Process

1. When the user proposes a requirement, **DO NOT** immediately write the spec.
2. **Context Gathering**: ALWAYS use search tools to consult the codebase first. Focus areas:
   - **Entry points**: Find the primary entry files or modules where the feature originates (ask the user if unsure about project structure conventions)
   - **Data models**: Search for related schemas, types, interfaces, or data structures
   - **Existing patterns**: Look for similar implementations to understand conventions
   - **Dependencies**: Find relevant services, libraries, APIs, or external integrations
   - **Constraints**: Check config files, environment variables, deployment setup, or any implicit limitations
3. Act as a rigorous, unrelenting Product Manager and Systems Architect.
4. **One Question at a Time**: NEVER bombard the user with a list of questions. You MUST ask exactly ONE piercing, specific question at a time.
5. Wait for the user's answer. Based on their answer and the codebase context, formulate the next logical question.
6. **Relentless Probe**: Dig deep into edge cases, error handling, UI/UX flows, backwards compatibility, breaking changes, and technical constraints.
7. **Resolve the Decision Tree**: Fully resolve one branch of the feature before moving to the next. Continue this back-and-forth iteration until the requirement is crystal clear and bulletproof.

### Phase 2: Alignment and Confirmation

1. Summarize the finalized, detailed requirements based on the user's answers.
2. Ask the user for final confirmation (e.g., "Are we aligned on these details? Should I proceed to generate the specification?").

### Phase 3: Specification Generation & Management

#### Step 1: Check for Existing Specs

Before creating new files:
1. List `sdd/specs/` to find directories matching the current intent.
2. If a match exists and has unchecked tasks → **resume** from where it left off (skip to Phase 4).
3. If a match exists and is fully completed (`status: completed`) → decide if a new spec is needed or if a new `changes/` entry under the existing spec suffices.
4. If no match → proceed to Step 2.

#### Step 2: Determine the Scope

Decide if this is a completely new requirement or a change to an existing one. Then assess complexity to determine which files (and which structure) to generate. There are **three** complexity tiers — use your judgment to pick the right one:

**Simple** (generate `spec.md` + `tasks.md` + `checklist.md`):
- Single module impact, no new interfaces or data models
- 1-5 tasks
- No breaking changes
- No new external dependencies

**Complex** (generate all 5 files: `proposal.md`, `design.md`, `spec.md`, `tasks.md`, `checklist.md`):
- Multi-module or cross-service impact
- New data models, interfaces, or public APIs
- Breaking changes or compatibility concerns
- 6+ tasks with complex dependencies
- Requires architectural decisions or new integrations

**Epic / OKR** (generate the master 5 files PLUS a `krs/` subdirectory of Key Result specs):
Use this tier when **a single `spec.md` cannot clearly enumerate the work**, typically:
- Large refactors (e.g., framework migration, module split)
- Data / system migrations
- Greenfield features composed of many independently-shippable sub-features
- Cross-team initiatives where each sub-goal has its own stakeholders or acceptance criteria
- Estimated 15+ tasks, OR 3+ logically separable sub-goals

The master `spec.md` defines the **Objective** (the "why" and overall outcome). Each child under `krs/` defines a **Key Result** — a measurable, independently verifiable sub-goal that contributes to the Objective.

**Decision rule when uncertain**:
1. Can the work be cleanly described in one `spec.md` without forcing unrelated requirements into the same document? If yes → Simple or Complex.
2. If the spec keeps growing into loosely-related sections, OR you find yourself writing "Phase A / Phase B / Phase C" of fundamentally different work → escalate to **Epic / OKR**.
3. Still unsure? Default to **Complex** for normal work, **Epic / OKR** for refactors/migrations.

#### Step 3: Create the Structure

Generate the necessary directories and markdown files in the appropriate location within the `sdd/specs` folder. **MUST** read and use the exact templates provided in the `references/` directory of this skill (paths are relative to this SKILL.md).

**Simple Requirements**: Create `spec.md` + `tasks.md` + `checklist.md`.
```
sdd/specs/<requirement-name>/
├── spec.md           # YAML Frontmatter, scope, functional requirements (SHALL/Scenario)
├── tasks.md          # Ordered task board with explicit dependencies and parallel markers
└── checklist.md      # Standalone verification criteria
```

**Complex Requirements**: Create all 5 files.
```
sdd/specs/<requirement-name>/
├── proposal.md       # Context, pain points, value proposition, alternatives, success metrics
├── design.md         # Technical architecture, data models, interfaces, data flow, error handling
├── spec.md           # YAML Frontmatter, scope, functional requirements (SHALL/Scenario)
├── tasks.md          # Ordered task board with explicit dependencies and parallel markers
└── checklist.md      # Standalone verification criteria
```

**Epic / OKR Requirements**: Create the master 5 files at the root, then create one subdirectory per Key Result under `krs/`. Each KR is itself a self-contained mini-spec (Simple or Complex tier).
```
sdd/specs/<epic-name>/
├── proposal.md       # Why this epic exists; the overall Objective
├── design.md         # Cross-cutting architecture decisions shared by all KRs
├── spec.md           # YAML Frontmatter (kind: epic), Objective, list of KRs with links and target metrics
├── tasks.md          # Epic-level coordination tasks ONLY (cross-KR sequencing, integration, rollout)
├── checklist.md      # Epic-level verification (Objective met, all KRs completed, integration verified)
└── krs/
    ├── kr-01-<name>/
    │   ├── spec.md       # YAML Frontmatter (kind: kr, parent: <epic-name>), Key Result statement, scope, SHALL/Scenario
    │   ├── tasks.md
    │   └── checklist.md
    │   # (proposal.md / design.md added if the KR itself qualifies as Complex)
    ├── kr-02-<name>/
    │   └── ...
    └── kr-03-<name>/
        └── ...
```

Epic / OKR rules:
- The master `spec.md` MUST set frontmatter `kind: epic` and list every KR under a `key_results:` array.
- Each KR `spec.md` MUST set frontmatter `kind: kr` and `parent: <epic-name>`.
- An epic is `completed` only when ALL KRs are `completed` AND the epic-level `checklist.md` passes.
- Do NOT duplicate KR-level functional requirements in the master `spec.md` — link to them.
- KRs SHOULD be independently shippable; if two KRs are tightly coupled, merge them.

**Modifying Existing Requirements**: Create a new change record under the existing requirement's `changes` directory. Apply the same Simple/Complex/Epic rule for file generation.

#### Step 4: Write `spec.md`

In addition to the template structure, for functional requirements use the **SHALL/Scenario** format to ensure testability:

```markdown
## N. Functional Requirements

### ADDED
#### Requirement: [Name]
The system SHALL ...

##### Scenario: [Case Name]
- **WHEN** [trigger condition]
- **THEN** [expected outcome]

### MODIFIED (if applicable)
#### Requirement: [Name]
[Complete modified requirement with context]

### REMOVED (if applicable)
#### Requirement: [Name]
**Reason**: [Why removing]
**Migration**: [How to handle existing usage]
```

#### Step 5: Write `tasks.md`

In addition to the template structure, **always** include a `# Task Dependencies` section:

```markdown
# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] and [Task 4] can run in parallel
```

Principles:
- Each task should deliver verifiable progress.
- Include validation steps (tests, linting) where appropriate.
- Mark parallelizable tasks explicitly.
- Do NOT over-design or over-estimate scope.

#### Step 6: Write `checklist.md`

Create a standalone verification checklist. Each item must be objectively verifiable:

```markdown
# Verification Checklist

- [ ] [Concrete and testable criterion 1]
- [ ] [Concrete and testable criterion 2]
- [ ] Unit tests pass
- [ ] No TypeScript errors
- [ ] No linting warnings
- [ ] Manual smoke test on target platform passes
```

#### Step 7: Update Global Registry

Add or update the entry in `sdd/project.md` to reflect the new feature, status, and dependencies.

#### Step 8: Confirm with User

Present the generated files to the user for review. Do NOT proceed to implementation until explicit approval is given.

---

### Phase 4: Implementation

1. Work through `tasks.md` in order, respecting the declared dependencies.
2. Check off each task and subtask as it is completed (`- [x]`).
3. For tasks marked as parallelizable with no inter-dependencies, work on them concurrently when possible.
4. If a task reveals new requirements or unforeseen complexity, follow **Exception Handling → E3** (pause, roll back status to `draft`, update spec, re-confirm, then resume).
5. Update the status in `spec.md` YAML Frontmatter as progress is made (e.g., `draft` → `in_progress`).

---

### Phase 5: Verification

1. Go through every item in `checklist.md`.
2. For each item, verify the criterion is met (run tests, inspect code, manual testing, etc.).
3. Check off passing items (`- [x]`).
4. If any item fails:
   - Add a new task to `tasks.md` to address it.
   - Implement the fix (Phase 4).
   - Re-verify (Phase 5).
5. When ALL items in `checklist.md` AND all tasks in `tasks.md` are checked (`- [x]`), update the requirement status to `completed` in BOTH the `spec.md` YAML Frontmatter AND the global registry `sdd/project.md`.

---

## Exception Handling

Defines how to recover from non-happy-path situations. Each rule maps to a specific phase and is mandatory — do not improvise alternative recoveries.

### E1. User Changes Intent Mid-Interrogation (Phase 1)
- **Signal**: User contradicts an earlier answer, or says "actually, forget that, I want X instead".
- **Action**:
  1. STOP the current question chain immediately.
  2. Summarize what has been captured so far and explicitly mark which parts are now invalidated.
  3. Restart Grill from the new intent. Do NOT silently merge old answers into the new direction.

### E2. User Rejects Confirmation (Phase 2 → Phase 1)
- **Signal**: At Phase 2, user replies with disagreement, additions, or a new constraint.
- **Action**:
  1. Do NOT regenerate the full requirement summary from scratch.
  2. Identify ONLY the specific points the user rejected.
  3. Re-enter Phase 1 *scoped to those points*. Continue One-Question-at-a-Time on that branch only.
  4. Re-summarize and ask for confirmation again.

### E3. Spec Gap Discovered During Implementation (Phase 4 → Phase 3)
- **Signal**: A task cannot be completed without a decision not covered by `spec.md`, OR existing spec contradicts reality.
- **Action**:
  1. Pause the current task. Do NOT improvise the missing decision in code.
  2. Update `spec.md` (and `design.md` if applicable). Roll status back: `in_progress → draft`.
  3. Re-run Phase 2 confirmation **only for the changed sections** (diff-style summary).
  4. Once approved, set status back to `in_progress` and resume the paused task.

### E4. Repeated Verification Failure (Phase 5)
- **Signal**: The same `checklist.md` item fails verification more than once.
- **Action** (in order):
  1. **Round 1 fail** → add a fix task to `tasks.md`, implement, re-verify.
  2. **Round 2 fail** → re-examine whether the checklist item is correctly specified. If the criterion itself is flawed, update `checklist.md` and re-confirm with user (Phase 2 mini-loop).
  3. **Round 3 fail** → STOP. Escalate to user with the failure history and ask whether to (a) split into a new requirement, (b) downgrade the criterion, or (c) abandon. Never enter a 4th retry silently.

### E5. Session Resumption After Interruption
- **Signal**: User returns to a requirement after a gap (new session, switched branch, etc.).
- **Action**:
  1. BEFORE asking anything, read `sdd/specs/<requirement-name>/spec.md` frontmatter `status`.
  2. Resume according to the state machine:
     - `draft` → re-display spec, ask for Phase 2 confirmation.
     - `in_progress` → open `tasks.md`, find the first unchecked task, propose continuation.
     - `completed` → confirm whether the user wants a new change record (`changes/`) or a brand-new requirement.
  3. Do NOT restart Phase 1 from scratch when status ≠ `pending`.

---

## Guardrails

- **No code in Phase 1–3.** Spec documents only. Do not implement anything before explicit user approval.
- **No rollback of unrelated changes.** The workspace may contain other people's work — leave it alone.
- **Favor minimal implementations.** Add complexity only when the spec requires it.
- **Spec documents use the same language as user communication.** Follow the language of the user's latest message.
- **Do not delete spec documents after completion.** They serve as the historical record and living documentation of the system.
- **Always consult the codebase before writing specs.** Specs written without understanding the existing system are worse than no specs at all.

---

## Task Status Management

- All newly created tasks in `tasks.md` and checklists in both `spec.md` and `checklist.md` must use Markdown task lists and be unchecked by default (`- [ ]`).
- When a task is completed, update its status to checked (`- [x]`).
- When ALL tasks and checklists for a requirement are checked (`- [x]`), its status MUST be updated to `completed` in BOTH the `spec.md` YAML Frontmatter AND the global registry `sdd/project.md`.

## Status State Machine

Allowed transitions:

| From | To | Condition |
|------|-----|-----------|
| `pending` | `draft` | User confirms requirement intent |
| `draft` | `draft` | User rejects Phase 2 confirmation; re-grill rejected points only (see E2) |
| `draft` | `in_progress` | User approves spec generation |
| `in_progress` | `draft` | Implementation reveals spec gaps (update spec first) |
| `in_progress` | `completed` | All tasks AND all checklist items verified |
| `completed` | `in_progress` | ONLY if user reports a verified bug or requests an unplanned enhancement |
| `completed` | `archived` | User explicitly requests archiving, or feature is deprecated |

**Forbidden transitions** (NEVER do these):
- `pending` → `completed` (must go through draft and in_progress)
- `draft` → `completed` (must implement and verify)
- Any state → `archived` without user explicit request

## Archiving Requirements

- **DO NOT** automatically archive (`archived`) a requirement just because it is completed. Completed requirements stay in the active `sdd/specs/` directory as active documentation of the current system.
- Only archive a requirement (move it to `sdd/archive/` and update `sdd/project.md`) if the user EXPLICITLY asks to archive it, or if the feature has been completely deprecated/replaced by a newer system.

## Opening the Dashboard

If the user asks to see the dashboard, kanban board, or wants to visualize the requirements:
1. Run the `scripts/dashboard.js` script using the terminal tool:
   ```bash
   node smart-requirement-workflow/scripts/dashboard.js
   ```
2. Set the command to run non-blocking (in the background).
3. Once the server starts, inform the user that they can view the dashboard by opening `http://localhost:3030` in their browser, or use the OpenPreview tool if available.
   *Note: Let the user know the dashboard features Real-Time Sync (SSE), Search/Filter, Interactive Details Modals (click cards to read markdown), Nested Subtasks, and i18n (EN/ZH).*

## Output

This skill produces files under the user's project, **not** standalone agent output. After a full run you can expect:

- `sdd/specs/<requirement-name>/spec.md` — always created (every tier).
- `sdd/specs/<requirement-name>/tasks.md` — always created.
- `sdd/specs/<requirement-name>/checklist.md` — always created (Simple, Complex, Epic).
- `sdd/specs/<requirement-name>/proposal.md` — Complex and Epic only.
- `sdd/specs/<requirement-name>/design.md` — Complex and Epic only.
- `sdd/specs/<requirement-name>/krs/kr-NN-<name>/...` — Epic only; one subdirectory per Key Result, each containing its own spec/tasks/checklist (and proposal/design if the KR is itself Complex).
- `sdd/specs/<requirement-name>/changes/<change-name>/...` — created when modifying an already-completed requirement.
- `sdd/project.md` — global registry; created on first run, updated on every status change.
- Status updates inside `spec.md` YAML frontmatter (`pending → draft → in_progress → completed`).
- Optional: a running kanban dashboard at `http://localhost:3030` when the user invokes the dashboard step.

This skill is conversational during Phases 1 and 2 (no files are written until the user approves Phase 3).

## Resources

- `references/proposal.template.md` — Context, pain points, value proposition, alternatives, success metrics.
- `references/design.template.md` — Technical architecture, data models, interfaces, data flow, error handling.
- `references/spec.template.md` — YAML frontmatter (status / impact_radius / dependencies / kind / parent / key_results), scope, SHALL/Scenario functional requirements.
- `references/tasks.template.md` — Ordered task board with `# Task Dependencies` section and parallel markers.
- `references/checklist.template.md` — Standalone, objectively verifiable acceptance checklist.
- `scripts/dashboard.js` — Zero-dependency Node kanban dashboard with SSE live updates, search, i18n (EN/ZH), nested subtasks (changes + krs).
- `README.md` / `README_zh.md` — User-facing overview and installation guide.