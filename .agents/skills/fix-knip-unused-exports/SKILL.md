---
name: fix-knip-unused-exports
description: |
  Fix knip "Unused exports" violations. Handles all violation categories: test-only exports
  (extract to new file), dead barrel re-exports (remove from index.ts), and internally-only-used
  exports (un-export).
  Use when `npm run knip` reports unused exports.
---

# Fix Knip Unused Exports

Fix knip "Unused exports" violations. There are several categories of violation, each with a different fix strategy.

## When to Use

- `npm run knip` reports "Unused exports"

## When NOT to Use

- The export is consumed by non-test production code in another file -- something else is wrong

## Workflow

### 1. Identify Violations

```bash
npm run knip
```

Output looks like:

```
Unused exports (3)
::error file=packages/foo/src/bar.ts,line=42,title=Unused exports::myFunction
```

### 2. Classify Each Violation

For each flagged export, grep the **entire repository** (not just the package):

```bash
rg "myFunction"
```

Determine which category it falls into:

| Category                        | Callers                                                                                               | Fix                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Test-only export**            | Used in same file + test files only                                                                   | Extract to new file                     |
| **Dead barrel re-export**       | Re-exported from `index.ts`, but production code imports via relative paths or other subpaths instead | Remove the re-export from the barrel    |
| **Internally-only-used export** | Used only within the same file, not by tests or other files                                           | Remove the `export` keyword             |
| **Dead code**                   | No callers anywhere                                                                                   | Delete the export                       |
| **Production consumer exists**  | Used by non-test code in another file                                                                 | Not a knip issue -- investigate further |

**Important**: When grepping, exclude test files to identify production consumers:

```bash
rg "myFunction" --glob '!**/*.test.*'
```

## Fix: Test-Only Exports (Extract to New File)

When a function is exported solely for test access but is also used internally in the same file.

### Plan the Extraction

Before writing code, answer these questions:

**a) What moves to the new file?**

- The flagged export function/class/const
- All private helper functions it depends on
- All private constants/types it depends on

**b) Are any helpers shared with functions staying behind?**

- If yes, the helper must be exported from the new file, and the original file imports it
- This means the new file will have 2+ exports (which is fine for any filename-match-export lint rule)

**c) Will the new file have exactly one exported function?**

- If your project enforces a `filename-match-export` lint rule, the file MUST be named after that export: `myFunction.ts`
- If the file has 2+ function exports, the name is flexible

**d) Does a test file with a matching name exist?**

- If `bar.ts` stays and `bar.test.ts` exists, the test must still import something from `./bar` (if your project enforces a `test-imports-source` rule)
- If `bar.ts` is deleted (everything moved out), that rule typically only applies when the matching source file exists

**e) Any circular dependency risk?**

- Draw the import graph: new file -> original file -> new file is circular
- Fix: move the shared dependency to the new file or a third file

**f) Does it export a constant?**

- If your project enforces a `constants-file-organization` lint rule, exported constants must live in a file named `constants.ts`
- If the extracted function depends on a constant that other functions in the original file also use, do NOT export the constant from the new file. Instead, call the function (e.g., replace `BUDGET[effort]` with `getBudget(effort)`) to avoid needing a separate `constants.ts`

### Execute the Extraction

Create the new file in the same directory:

```typescript
// myFunction.ts (new file)
import { SomeType } from '../types';

function privateHelper(): void {
  /* ... */
}

export function myFunction(): SomeType {
  return privateHelper();
}
```

Update the original file to import from the new file:

```typescript
// bar.ts (original file, updated)
import { myFunction } from './myFunction';

function otherFunction() {
  const result = myFunction(); // Now imports from new file
}
```

Update test files to import from the new file:

```typescript
// bar.test.ts (updated)
import { myFunction } from './myFunction';
// If bar.ts still exists, you may need to also import something from './bar'
// to satisfy any test-imports-source rule
```

### Watch for Chained Violations

After extracting, run `npm run knip` again. If function A was extracted to a new file alongside function B that A calls, but B is also only consumed by tests externally, knip will flag B too. You need to extract B to its own file so that A's file creates a genuine production import of B.

Example: suppose `throwMappedError` was first extracted alongside `mapResponseFailure` into `error-mappers.ts`. If `throwMappedError` is only called internally within that file (by `mapResponseFailure`), it will still be flagged. Fix: extract it to `throwMappedError.ts`, making the import from `error-mappers.ts` a genuine production consumer.

## Fix: Dead Barrel Re-Exports (Remove from index.ts)

When a barrel `index.ts` re-exports something, but no production code imports it through the barrel. This happens when:

- Production code within the same package uses relative imports (e.g., `import { x } from './source'`) instead of the barrel
- Production code in other packages imports directly from a subpath (e.g., `@scope/pkg/feature/handlers`) instead of the barrel
- The re-export was added speculatively but never consumed

### How to Identify

Grep excluding test files. If the only hits are:

- The barrel `index.ts` itself
- Source files using relative imports within the same package
- Test files

Then the barrel re-export is unused. Simply remove it from `index.ts`.

### Cross-Package Test Imports

If a test in another package imports the symbol through the barrel (e.g., `import { x } from '@scope/pkg/feature'`), you need to provide an alternative import path after removing the barrel re-export:

1. Add a **subpath export** in the source package's `package.json`:

   ```json
   {
     "exports": {
       "./feature": "./src/feature/index.ts",
       "./feature/doSomething": "./src/feature/doSomething.ts"
     }
   }
   ```

2. Update the test to import from the new subpath:
   ```typescript
   import { doSomething } from '@scope/pkg/feature/doSomething';
   ```

This pattern follows typical subpath-export conventions used in monorepos.

## Fix: Internally-Only-Used Exports (Un-export)

When an export is only used within the same file and not imported by anything else (not even tests), just remove the `export` keyword:

```typescript
// Before
export const MySchema = z.object({ ... });

// After
const MySchema = z.object({ ... });
```

This is common for Zod schemas that are only used as building blocks for other schemas in the same file.

## Verify

Run ALL of these checks on the affected packages:

```bash
# Knip passes (the whole point)
npm run knip

# Types still compile
npm run typecheck

# Tests still pass
npm run test

# Lint passes (catches filename-match-export, test-imports-source, constants-file-organization, etc.)
npm run lint
```

If cross-package imports exist, also verify the consuming package.

## Interacting Lint Rules

Many TypeScript monorepos layer additional custom lint rules on top of knip. Adapt the fixes below to whichever of these your project uses.

### `filename-match-export` (or similar)

If a file has exactly ONE exported function (not a React component), the filename must match the function name.

- `export function loadConfig` in `loadConfig.ts` -- passes
- `export function loadConfig` in `helpers.ts` -- fails
- Two exports in `helpers.ts` -- rule does not apply (multiple exports)

### `test-imports-source` (or similar)

If `foo.test.ts` and `foo.ts` both exist, the test must import from `./foo`.

- Imports like `import { x } from './foo'` satisfy the rule
- Typically also accepts importing from `'.'` or `'./index'` if `index.ts` re-exports from `foo.ts`
- If `foo.ts` is deleted, the rule does not apply

### `constants-file-organization` (or similar)

Exported constants must be defined in a file named `constants.ts`.

- If you extract a function that depends on a shared constant, do NOT export the constant from the function's file
- Instead, replace direct constant access with function calls (e.g., `BUDGET[effort]` becomes `getBudget(effort)`)
- Or move the constant to a `constants.ts` file

### How Knip Traces Exports

- Knip ignores test files (`**/*.test.*`, `**/*.spec.*`)
- `ignoreIssues` in `knip.json` suppresses warnings ON the listed file, but does NOT make the source export "used"
- Barrel re-exports (`export { x } from './source'`) from an `index.ts` with `ignoreIssues` do NOT count as usage of the source export
- Only genuine imports from non-test, non-ignored project files count as usage
- `includeEntryExports: true` (if set) means exports from entry point files are checked too, so entry-point-style files (migrations, scripts) may need explicit `ignoreIssues`

### Package Subpath Exports

When removing barrel re-exports that cross-package tests relied on, add subpath exports to `package.json`:

```json
{
  "exports": {
    "./feature": "./src/feature/index.ts",
    "./feature/doSomething": "./src/feature/doSomething.ts"
  }
}
```

## What Not to Do

- Do not add files to `ignoreIssues` in `knip.json` unless they are genuine entry point scripts (migrations, CLIs)
- Do not merge all functions into one file to reduce exports -- same-file usage of an export does not count as usage from knip's perspective
- Do not remove the `export` keyword if tests need it -- the tests would break
- Do not create circular imports between the new and original files
- Do not export constants from non-`constants.ts` files if your project enforces a `constants-file-organization` lint rule
