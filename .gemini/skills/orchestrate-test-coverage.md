---
name: orchestrate-test-coverage
description: >
  MUST USE when the user wants to add, write, fix, or improve test coverage, or when tests are failing. Orchestrates a subagent to analyze and write/repair tests. Triggers: test coverage, cover this, fix tests, repair tests, tests fail.
---

# Orchestrate Test Coverage

## Purpose

Determine target files and invoke a `Test Writer` subagent to write/enhance vitest tests following project conventions.

## Instructions

### Step 1: Determine mode and targets

Analyze the user's request to determine the mode:

**Mode "files"** — user specifies one or more file paths:

- Validate the files exist via `list_dir` or checking directory structure.
- If any file doesn't exist, report and STOP.

**Mode "repair"** — user mentions broken tests, failing tests, or asks to fix/repair tests:

- If user specifies test file paths, use those directly.
- If user specifies source file paths, derive test paths: `src/.../File.ts` → `src/.../__tests__/File.test.ts`
- If no specific files, run `pnpm test` to identify failing tests.
- Validate the test files exist. If not, report and STOP.

**Mode "staged"** — user mentions staged changes, staged files, or similar:

- Run `git diff --cached --name-only` via `run_command`
- If nothing staged, tell the user and STOP.
- Filter to source files only (`.ts`, `.tsx`, exclude test/spec files).
- If no source files after filtering, tell the user and STOP.

**Mode "directory"** — user specifies a directory:

- Validate the directory exists.

Print to the user:

```
🧪 Test mode: [files/staged/directory/repair]
📁 Targets: [file list or directory path]
```

### Step 2: Analyze targets before invoking the Test Writer subagent

For each target file, perform a pre-analysis to identify what the tests MUST cover:

1. Read the source file.
2. Identify all branches and conditions:
   - Early returns / guard clauses
   - Switch/case statements
   - Error boundaries and error states
   - Loading/empty states
3. Identify all side effects:
   - Promise resolutions and rejections
   - Event handlers and their edge cases (empty input, incorrect inputs)
4. Identify parameters combinations that produce different behavior.

Produce a **coverage requirements table**:

| Branch/Condition | Location (line) | Currently tested? | Priority |
| ---------------- | --------------- | ----------------- | -------- |

To check "Currently tested?", look for existing test files (`__tests__/[FileName].test.ts`) and grep for the condition/variable name.

### Step 3: Invoke Test Writer subagent

Use `invoke_subagent` with `TypeName: "self"` and `Role: "Test Writer"` and query:

```
Please write or enhance the test coverage following the project's Vitest conventions.
mode: [files/staged/directory/repair]
targets: [comma-separated file paths or directory path]

MANDATORY COVERAGE TARGETS (from pre-analysis):
[Paste the coverage requirements table rows where Currently tested? = No]
Each row MUST have at least one test case. Do NOT skip any.
```

Wait for response.

### Step 4: Post-validation

After the subagent completes:

1. Run the tests to verify they pass:
   ```bash
   pnpm test [test-file-paths]
   ```
2. Cross-reference the coverage requirements table from Step 2 against the generated tests:
   - Verify a corresponding test exists (grep for the condition/variable in the test file).
   - Any uncovered row is a gap — report it to the user.
3. If tests fail, report the specific failures and ask the user whether to re-invoke the subagent in repair mode.
