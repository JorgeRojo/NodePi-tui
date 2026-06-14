# PRT: 02-Startup-Validations

## Overview

PRD: `./DOCS/TASKS/PRD-02-Startup-Validations.md` Implement a strict, pre-flight validation engine that runs sequentially before the Ink TUI mounts. If system tools, global configuration, or the target Vite project are invalid, it throws a chalk-colored error and exits gracefully without crashing the TUI renderer.

## 🔍 Codebase Analysis

- **Entry Point**: `src/index.tsx` currently directly calls `render(<App />)`. This will be modified to execute an asynchronous `bootstrap()` function.
- **Rules Applied**:
  - `architecture-ink.md`: Logic must extract pure data. Colors (`chalk`) apply to outputs but we must avoid `console.log` during the TUI lifecycle. Since this runs _before_ Ink mounts, writing to `console.error` with `chalk` upon failure is permissible as a graceful fallback.
  - `typescript.md`: NodeNext relative imports strictly require `.js` extensions (e.g., `import { validateSystem } from './systemValidator.js'`).
  - `testing-vitest.md`: Use `vi.fn()` and `vi.mock()` for external modules (`execa`, `fs/promises`). Tests must have an `afterEach(vi.clearAllMocks)`. 100% coverage target for core logic.

## 📁 Scope of Changes

- ✨ `src/core/validators/systemValidator.ts` — Create
- ✨ `src/core/validators/__tests__/systemValidator.test.ts` — Create
- ✨ `src/core/validators/configValidator.ts` — Create
- ✨ `src/core/validators/__tests__/configValidator.test.ts` — Create
- ✨ `src/core/validators/targetValidator.ts` — Create
- ✨ `src/core/validators/__tests__/targetValidator.test.ts` — Create
- ✨ `src/core/validators/index.ts` — Create (Orchestrator)
- ✨ `src/core/validators/__tests__/index.test.ts` — Create
- ✏️ `src/index.tsx` — Modify

## 📋 Implementation Steps

### Step 1: Implement System Tools Validator

**File**: `src/core/validators/systemValidator.ts` **Action**: Create **Reference**: N/A **What to do**:

- Import `execa` to check for `pnpm`, `rsync`, and `git`.
- Implement `export const validateSystem = async (): Promise<void> => { ... }`.
- Use `await execa('command', ['-v'])` (or similar) to verify existence.
- If an `execa` call fails, throw an `Error` using `chalk.red('System dependency missing: <tool>')`. **Rules to follow**: `typescript.md` (explicit return types), `architecture-ink.md` (pure data until throw).

### Step 2: Implement Global Config Validator

**File**: `src/core/validators/configValidator.ts` **Action**: Create **Reference**: N/A **What to do**:

- Import `fs/promises` and `os` or use a standard path resolution to locate `~/.nodepirc.json`.
- Implement `export const validateConfig = async (): Promise<void> => { ... }`.
- Check if file exists using `fs.stat` or `fs.access`. If missing, throw.
- Parse the JSON. Verify `containers` is an array and has `.length >= 1`.
- Verify paths in `containers` resolve under `~/`.
- Throw colored errors using `chalk` for any invalid states. **Rules to follow**: `typescript.md` (data parsing null checks), `architecture-ink.md`.

### Step 3: Implement Target Integrity Validator

**File**: `src/core/validators/targetValidator.ts` **Action**: Create **Reference**: N/A **What to do**:

- Import `fs/promises`. Use `process.cwd()`.
- Implement `export const validateTarget = async (): Promise<void> => { ... }`.
- Check for `package.json` and a Vite config file (`vite.config.ts` or `vite.config.js`) using `fs.access`.
- Throw `new Error(chalk.red('Not a valid Vite project.'))` if missing. **Rules to follow**: Do not run target scripts (PRD).

### Step 4: Implement Orchestrator and Integration

**File**: `src/core/validators/index.ts` **Action**: Create **What to do**:

- Export a single function `export const runPreflightValidations = async (): Promise<void> => { ... }` that sequentially awaits `validateSystem()`, `validateConfig()`, and `validateTarget()`. **Rules to follow**: `typescript.md` (NodeNext `.js` imports).

### Step 5: Update App Entry Point

**File**: `src/index.tsx` **Action**: Modify **Reference**: `src/ui/App.tsx` **What to do**:

- Wrap the execution in an `async function bootstrap()` or an IIFE.
- Call `await runPreflightValidations()`.
- If it throws, catch the error, `console.error(error.message)` (safe here as Ink hasn't mounted), and `process.exit(1)`.
- If successful, `render(<App />)`. **Rules to follow**: `typescript.md` (`.js` import for `runPreflightValidations.js`).

### Step 6: Write Tests for Validators

**File**: `src/core/validators/__tests__/*.test.ts` **Action**: Create **Reference**: `src/ui/__tests__/App.test.tsx` **What to do**:

- Create tests for all 4 files.
- Mock `execa` in `systemValidator.test.ts`.
- Mock `fs/promises` in `configValidator.test.ts` and `targetValidator.test.ts`.
- Use `afterEach(vi.clearAllMocks)`.
- Achieve 100% test coverage for these core validations. **Rules to follow**: `testing-vitest.md` (MANDATORY: always mock external Node modules to prevent real OS execution).

## 🔗 Step Dependencies

Step 1, 2, and 3 can be done in parallel. Step 4 depends on 1, 2, and 3. Step 5 depends on 4. Step 6 should ideally be done concurrently with Steps 1-4 following TDD.

## ✅ Validation Checklist

- [ ] TypeScript: `pnpm tsc --noEmit`
- [ ] Tests: `pnpm test src/core/validators`
- [ ] Coverage: `pnpm vitest run --coverage src/core/validators`
