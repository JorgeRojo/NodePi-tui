# PRT: Backup and Restore Engine

## Overview

PRD: [PRD-09-Backup-Restore.md](file:///Users/jorge/projects/NodePi-tui/DOCS/TASKS/PRD-09-Backup-Restore/PRD-09-Backup-Restore.md) Implement a fast backup and restore mechanism to guarantee workspace safety by physically copying critical files before injection and restoring them instantly upon exit signals (`SIGINT`, `SIGTERM`, `uncaughtException`), preventing orphan Vite servers and corrupted dependencies.

## 🔍 Codebase Analysis

- **Entrypoint (`src/index.tsx`)**: Bootstraps the application, parses arguments, and renders the Ink `<App />`. Signal handlers must be registered here before rendering.
- **Orchestrator (`src/core/execution/orchestrator.ts`)**: Runs the pipeline sequentially. The `injectViteWrapper` is called here. We must perform the physical backup _before_ this step, and also back up `node_modules/<dep>` before syncing.
- **Rules Applied**:
  - `cli-standards.md`: Synchronous restore on exit.
  - `testing-vitest.md`: Core logic needs 100% coverage, and external modules (`fs`, `fs/promises`, `execa`) MUST be mocked.
  - `typescript.md`: Explicit return types, use `.js` extension for imports, explicit parsing.

## 📁 Scope of Changes

- ✨ `src/core/backupManager.ts` — Create
- ✨ `src/core/__tests__/backupManager.test.ts` — Create
- ✏️ `src/core/execution/orchestrator.ts` — Modify
- ✏️ `src/index.tsx` — Modify

## 📋 Implementation Steps

### Step 1: Create Backup Manager

**File**: `src/core/backupManager.ts` **Action**: Create **Reference**: `src/core/execution/cache.ts` **What to do**:

- Export `backupTarget(cwd: string, deps: string[])` that copies `package.json`, `pnpm-lock.yaml`, and `node_modules/<dep>` to `cwd/.nodepi-backup/`. Use `fs/promises` `cp` with `{ recursive: true, force: true }`.
- Export `restoreTargetSync(cwd: string)` that synchronously copies backups back to their original locations using `fs.cpSync({ recursive: true, force: true })` (since this runs in exit handlers where async is risky) or `await` a `fs.promises.cp` but ensure it runs completely. The PRD says "Avoid async operations inside exit handlers if possible". We'll use `fs.cpSync` and `fs.rmSync` for the `.vite.config.nodepi.ts`. **Rules to follow**: `typescript.md` (no `any`, strict types, explicit returns).

### Step 2: Implement Backup Manager Tests

**File**: `src/core/__tests__/backupManager.test.ts` **Action**: Create **Reference**: `src/core/execution/__tests__/cache.test.ts` **What to do**:

- Write unit tests for `backupTarget` and `restoreTargetSync`.
- **CRITICAL**: Use `vi.mock('fs/promises')` and `vi.mock('node:fs')` to absolutely guarantee tests never alter real files on disk.
- Mock `cp`, `cpSync`, `rm`, `rmSync`, `mkdir`. **Rules to follow**: `testing-vitest.md` (TDD, 100% coverage, strictly mock `fs`).

### Step 3: Register Signal Handlers in Entrypoint

**File**: `src/index.tsx` **Action**: Modify **Reference**: `src/index.tsx` **What to do**:

- Add listeners for `SIGINT`, `SIGTERM`, and `uncaughtException` right after `parseArgs` but before `bootstrap()`.
- Inside the handlers, call `restoreTargetSync(process.cwd())`.
- Then gracefully kill background processes if necessary (or rely on detached process group kill logic in `processManager`), and finally call `process.exit(0)` (or `1` for uncaught exceptions). **Rules to follow**: `cli-standards.md` (Trap exit signals, synchronous restore without `pnpm install`).

### Step 4: Integrate Backup into Orchestrator

**File**: `src/core/execution/orchestrator.ts` **Action**: Modify **Reference**: `src/core/execution/orchestrator.ts` **What to do**:

- Import `backupTarget` from `../backupManager.js`.
- In `runPipeline`, before `injectViteWrapper` and before syncing node_modules, invoke `await backupTarget(store.target.cwd, sortedDependencies.map(d => d.name))`.
- This ensures a backup exists right before modifications happen. **Rules to follow**: `typescript.md` (NodeNext imports `.js`).

## 🔗 Step Dependencies

Step 1 -> Step 2 -> Step 3 -> Step 4

## ✅ Validation Checklist

- [ ] TypeScript: `pnpm tsc --noEmit`
- [ ] Tests: `pnpm test backupManager`
- [ ] Build: `pnpm build`
- [ ] Verify Instant Exit: Run app, press `Ctrl+C`, verify `.nodepi-backup` restores correctly and no Vite servers are left running.
