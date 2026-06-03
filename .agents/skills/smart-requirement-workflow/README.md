# Trae Skill: Smart Requirement Workflow

[English](README.md) | [中文](README_zh.md)

Smart Requirement Workflow is an intelligent AI Agent Skill that combines **rigorous requirement interrogation (the "Grill")** with a full **Specification-First (SDD)** workflow — from requirement gathering through to verified implementation. It acts as both a rigorous Product Manager and a Systems Architect, ensuring that your vague or incomplete requirements are fully clarified before a single line of documentation or code is written, and that implementation stays on track through to verified completion.

## ✨ Core Features

- **The "Grill" Interrogation** (Phase 1): Analyzes your initial request and asks **one targeted question at a time** to resolve missing details, edge cases, UI/UX flows, and technical constraints — all informed by live codebase context.
- **Alignment & Confirmation** (Phase 2): Summarizes the finalized requirements based on your answers and asks for your final confirmation before generating any specification documents.
- **Check for Existing Specs**: Before creating new specs, scans `sdd/specs/` for matching work that can be resumed or extended, preventing duplicate effort.
- **Specification Generation** (Phase 3): After confirmation, automatically generates documents based on complexity:
  - **Simple requirements** (`spec.md` + `tasks.md` + `checklist.md`): Single module, 1-5 tasks, no breaking changes
  - **Complex requirements** (all 5 files): Multi-module, new data models, 6+ tasks, architectural decisions
  - **Epic / OKR requirements** (master 5 files + `krs/` subdirectory): Large refactors, migrations, or initiatives where one `spec.md` can't enumerate the work — split into a master Objective spec and one self-contained KR spec per measurable sub-goal
- **SHALL/Scenario Requirement Format**: Structured requirements with `The system SHALL … / WHEN … THEN …` scenarios for built-in testability and clarity.
- **Implementation Guidance** (Phase 4): Tasks are executed in dependency order, with parallel markers for concurrent work. Mid-implementation discoveries feed back into spec updates.
- **Independent Verification** (Phase 5): A dedicated verification phase using the standalone `checklist.md`, with a fix-retry loop until every item passes.
- **Exception Handling**: Explicit recovery rules for non-happy-path situations — intent changes mid-interrogation, rejected confirmations, mid-implementation spec gaps, repeated verification failures, and session resumption.
- **Guardrails**: Explicit guardrails prevent premature coding, protect unrelated work, and enforce minimal implementations.
- **Machine-Readable Metadata**: Injects YAML Frontmatter into `spec.md` (status, impact radius, dependencies), enabling the AI Agent to instantly understand the impact radius and dependencies.
- **Global Project Registry**: Automatically maintains an `sdd/project.md` file as a centralized index for all active and archived features.
- **Zero Context Loss**: Keeps the AI focused during long coding sessions by relying on the highly detailed, clarified documents.

## ✅ Prerequisites

Before invoking the skill, make sure:

- **Project root is writable** — the skill creates and updates files under `sdd/` (e.g., `sdd/specs/<name>/`, `sdd/project.md`).
- **Codebase is searchable** — Phase 1 mandates Context Gathering via search/grep tools.
- **Templates are present** — `references/proposal.template.md`, `design.template.md`, `spec.template.md`, `tasks.template.md`, `checklist.template.md` must exist alongside `SKILL.md`.
- **Node.js 14+** — required only if you want to launch the kanban dashboard via `scripts/dashboard.js` (port 3030 must be free).
- **Interactive session** — Phases 1, 2, and 3 (Step 8), plus all E1–E5 exception flows require user input. Do not invoke in headless/CI contexts.

## 🚀 How to Use (Workflow)

You can trigger the Smart Requirement Workflow skill by making requests like:
- "Use smart-requirement-workflow to add a new login feature."
- "I have a new idea for a shopping cart, let's use smart-requirement-workflow."
- "Implement the feature we specified last week."

### The 5-Phase Execution

1. **Phase 1: Interrogation (The "Grill")**
   - The AI **will not** immediately write the spec.
   - **Context Gathering**: The AI will first consult the codebase to understand the current architecture, data models, and constraints (entry points, data models, existing patterns, dependencies, constraints — language-agnostic).
   - **Quick Path**: If your requirement is already well-defined (clear scope, known user flows, acceptance criteria, no cross-module impacts), the AI may offer to skip deep interrogation. You can accept the shortcut or insist on thorough edge-case exploration.
   - **One Question at a Time**: The AI will NEVER bombard you with a list of questions. It will ask exactly ONE specific, piercing question at a time.
   - You answer the question, and the AI iterates based on your answer and the codebase context, digging into edge cases until all decision branches are resolved.
2. **Phase 2: Alignment and Confirmation**
   - The AI summarizes the finalized, detailed requirements based on your answers.
   - It asks for your final confirmation before proceeding.
3. **Phase 3: Specification Generation**
   - Checks for existing matching specs to avoid duplicates.
   - Once confirmed, the AI generates the complete SDD structure (`proposal.md`, `design.md`, `spec.md`, `tasks.md`, `checklist.md`) in the `sdd/specs/` directory, updates the global registry, and presents the documents for review.
   - **No code is written until you explicitly approve.**
4. **Phase 4: Implementation**
   - The AI works through `tasks.md` in dependency order, checking off completed tasks.
   - Parallelizable tasks are executed concurrently.
   - If new requirements emerge during implementation, specs are updated before continuing.
5. **Phase 5: Verification**
   - Every item in `checklist.md` is verified against the actual implementation.
   - If an item fails, a new task is added to `tasks.md`, the fix is implemented, and verification re-runs.
   - When all tasks and checklists are complete, the status is updated to `completed`.

### Exception Handling (Non-Happy Paths)

The workflow defines explicit recovery rules so the AI never improvises when things go off-script:

| Code | Scenario | Recovery |
|------|----------|----------|
| **E1** | User changes intent mid-interrogation | Stop the question chain, mark invalidated answers, restart Grill from the new intent (no silent merging) |
| **E2** | User rejects Phase 2 confirmation | Re-enter Phase 1 *only on the rejected points*, then re-summarize and re-confirm |
| **E3** | Implementation reveals spec gap | Pause the task, roll status back `in_progress → draft`, update spec, re-confirm only the diff, then resume |
| **E4** | Same checklist item fails repeatedly | Round 1: fix & retry. Round 2: question the criterion itself. Round 3: STOP and escalate to user — never enter a 4th retry silently |
| **E5** | Session resumed after interruption | Read `spec.md` frontmatter `status` first, then continue from the corresponding phase instead of restarting Phase 1 |

## 📂 Directory Structure & Conventions

This skill manages the workflow through the `sdd` folder located in the root directory of your project.

### 1. Requirements by Complexity

#### Simple Requirements
Created under `sdd/specs/<requirement-name>/` with the essential trio:
- **`spec.md`**: YAML Frontmatter, scope, **SHALL/Scenario** functional requirements.
- **`tasks.md`**: Executable task board ordered by phase, with explicit `# Task Dependencies` and parallel markers.
- **`checklist.md`**: Standalone verification criteria.

#### Complex Requirements
Created under `sdd/specs/<requirement-name>/` with full SDD structure:
- **`proposal.md`**: Context, current pain points, feature value proposition, alternatives considered, success metrics.
- **`design.md`**: Technical architecture, data models, interfaces, data flow, error handling strategies.
- **`spec.md`**: YAML Frontmatter, scope, **SHALL/Scenario** functional requirements (ADDED/MODIFIED/REMOVED).
- **`tasks.md`**: Executable task board ordered by phase, with explicit `# Task Dependencies` and parallel markers.
- **`checklist.md`**: Standalone verification criteria — objectively verifiable items across functional, code quality, testing, and non-functional categories.

#### Epic / OKR Requirements
Used when a single `spec.md` cannot clearly enumerate the work — large refactors, migrations, multi-team initiatives, or features composed of many independently-shippable sub-features.

A master Objective spec lives at the root; each measurable Key Result lives in its own self-contained sub-spec under `krs/`:

```
sdd/specs/<epic-name>/
├── proposal.md       # Why this epic exists; the overall Objective
├── design.md         # Cross-cutting architecture decisions shared by all KRs
├── spec.md           # kind: epic, Objective + key_results list
├── tasks.md          # Epic-level coordination tasks ONLY
├── checklist.md      # Epic-level verification (Objective met, all KRs done)
└── krs/
    ├── kr-01-<name>/   # kind: kr, parent: <epic-name>
    │   ├── spec.md
    │   ├── tasks.md
    │   └── checklist.md
    └── kr-02-<name>/
        └── ...
```

The epic is `completed` only when every KR is `completed` AND the epic-level checklist passes.

### 2. Modifying Existing Requirements
Created as a change record: `sdd/specs/<existing-requirement-name>/changes/<change-name>/` containing the same five core files to clearly track the motivation and implementation details of the change.

## 📌 Task Status & Lifecycle Management

- **Task Tracking**: All tasks and checklists use Markdown task lists (`- [ ]`).
- **Status Updates**: Completed tasks are checked (`- [x]`).
- **Feature Closure**: When all tasks AND all checklist items are completed, the status in `spec.md` YAML Frontmatter and `sdd/project.md` is updated to `completed`.
- **Archiving**: Features are only moved to `sdd/archive/` if explicitly requested or completely deprecated. Completed features remain in `sdd/specs/` as living documentation.

### Status State Machine

```
pending → draft → in_progress → completed → archived
               ↑_______________|
```

| From | To | When |
|------|-----|------|
| `pending` | `draft` | User confirms requirement intent |
| `draft` | `in_progress` | User approves spec generation |
| `in_progress` | `draft` | Implementation reveals spec gaps |
| `in_progress` | `completed` | All tasks & checklist items verified |
| `completed` | `in_progress` | Only for verified bugs or unplanned enhancements |
| `completed` | `archived` | User explicitly requests archiving |

**Never skip states**: A requirement must go through `pending → draft → in_progress → completed`. Direct jumps are forbidden.

## 🛡️ Guardrails

- **No code before approval**: Specification documents only during Phases 1–3.
- **Leave unrelated code alone**: The workspace may contain other people's work.
- **Minimal implementations**: Add complexity only when the spec requires it.
- **Language consistency**: Spec documents follow the user's language.
- **Codebase-aware specs**: Always consult the existing system before writing.
- **Preserve spec documents**: Do not delete spec documents after completion — they serve as the living documentation and historical record of the system.

## 📊 Live Kanban Dashboard

Smart Requirement Workflow includes a built-in, zero-dependency Node.js script to visualize your requirements as a live Kanban board.

### ✨ Dashboard Features
- **Real-Time Sync (SSE)**: Automatically syncs Markdown file changes.
- **Rich Details Modal**: Click cards to read `proposal`, `design`, `spec`, `tasks`, and `checklist`.
- **Nested Subtasks**: Both `changes/` and `krs/` (epic key results) are visually nested under their parent card.
- **Instant Search**: Real-time filtering by name, dependencies, or subtasks.
- **i18n Support**: English and Chinese interfaces.

Simply ask the AI:
> "Open the requirements dashboard"

The AI will automatically start the background server and provide a preview link (**http://localhost:3030**).

## 📤 Output Summary

What this skill produces inside your project:

| File | Created when |
|------|--------------|
| `sdd/specs/<name>/spec.md` | Always |
| `sdd/specs/<name>/tasks.md` | Always |
| `sdd/specs/<name>/checklist.md` | Always (Simple, Complex, Epic) |
| `sdd/specs/<name>/proposal.md` | Complex & Epic |
| `sdd/specs/<name>/design.md` | Complex & Epic |
| `sdd/specs/<name>/krs/kr-NN-<name>/...` | Epic only — one per Key Result |
| `sdd/specs/<name>/changes/<change-name>/...` | When modifying a completed requirement |
| `sdd/project.md` | Created on first run, updated on every status change |

Phases 1 and 2 are conversational — no files are written until you approve Phase 3.

## 📚 Resources

| Path | Purpose |
|------|---------|
| `references/proposal.template.md` | Context, pain points, value proposition, alternatives, success metrics |
| `references/design.template.md` | Technical architecture, data models, interfaces, data flow, error handling |
| `references/spec.template.md` | YAML frontmatter (`status` / `impact_radius` / `dependencies` / `kind` / `parent` / `key_results`), scope, SHALL/Scenario |
| `references/tasks.template.md` | Ordered task board with `# Task Dependencies` and parallel markers |
| `references/checklist.template.md` | Standalone, objectively verifiable acceptance checklist |
| `scripts/dashboard.js` | Zero-dependency Node kanban dashboard (SSE + i18n + nested subtasks) |
| `SKILL.md` | The full skill specification consumed by the AI agent |