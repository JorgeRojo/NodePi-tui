# PRT: 08-Orchestration-Sequence

## Overview

PRD: `DOCS/TASKS/PRD-08-Orchestration-Sequence/PRD-08-Orchestration-Sequence.md` This PRT details the implementation of the orchestration sequence in NodePi-tui. It covers the creation of the core execution pipeline (cache management, Vite wrapper generation, chokidar+rsync watchers, and the sequential/parallel orchestrator), alongside the necessary global keybindings in the Ink UI to trigger these flows.

## 🔍 Codebase Analysis

- **`src/store/appStore.ts`**: The central state. Needs a new status flag (`pipelineStatus`) to track if the system is running or idle, avoiding duplicate executions.
- **`src/core/execution/ProcessManager.ts`**: Already implements secure `{ detached: true }` spawning and PTY emulation (`script -q /dev/null`). The orchestrator will leverage this for all shell-based executions (`pnpm`, dev server).
- **`src/core/config-manager/sorter.ts`**: Contains `sortTopologically` which will be used by the orchestrator to build local dependencies in the correct order.
- **Rules Applied**:
  - `typescript.md`: Strict typing, `NodeNext` `.js` import enforcement.
  - `testing-vitest.md`: `vi.mock('execa')`, `vi.mock('chokidar')`, `afterEach(vi.clearAllMocks)` are mandatory for testing the pipeline without side-effects.
  - `architecture-ink.md`: No JSX from hooks (`useGlobalKeybindings`), use pure services for core logic, no `console.log`.
  - `agent-harnessing.md`: Always use `pnpm` for tasks.

## 📁 Scope of Changes

- ✨ `src/core/execution/cache.ts` — Create
- ✨ `src/core/execution/viteWrapper.ts` — Create
- ✨ `src/core/execution/watcher.ts` — Create
- ✨ `src/core/execution/orchestrator.ts` — Create
- ✨ `src/ui/hooks/useGlobalKeybindings.ts` — Create
- ✨ `src/core/execution/__tests__/cache.test.ts` — Create
- ✨ `src/core/execution/__tests__/viteWrapper.test.ts` — Create
- ✨ `src/core/execution/__tests__/watcher.test.ts` — Create
- ✨ `src/core/execution/__tests__/orchestrator.test.ts` — Create
- ✏️ `src/store/appStore.ts` — Modify
- ✏️ `src/ui/App.tsx` — Modify

## 📋 Implementation Steps

### Step 1: Update App Store with Pipeline State

**File**: `src/store/appStore.ts` **Action**: Modify **What to do**:

- Add `pipelineStatus: 'idle' | 'running' | 'error'` to `AppState`.
- Add `setPipelineStatus: (status: AppState['pipelineStatus']) => void` to the store actions. **Rules to follow**: `typescript.md` (no `any`), `architecture-ink.md` (state organization).

### Step 2: Implement Smart Cache Manager

**File**: `src/core/execution/cache.ts` **Action**: Create **Reference**: `src/core/config-manager/io.ts` **What to do**:

- Implement a class or functions to hash a directory using native `crypto` module.
- Provide `isCacheValid(dirPath)` and `updateCache(dirPath)` methods.
- Read/write from/to `.nodepi-cache.json` in the target `cwd`. **Rules to follow**: `typescript.md` (ESM imports `.js`), `agent-harnessing.md` (no raw shell for `cat`/`ls`).

### Step 3: Implement Vite Wrapper Generator

**File**: `src/core/execution/viteWrapper.ts` **Action**: Create **What to do**:

- Create `injectViteWrapper(targetCwd: string)` which reads the target's `package.json` to inject `"injected": true`.
- Generate a `.vite.config.nodepi.ts` file extending the target's existing config, forcing pre-bundling caches to be disabled (e.g., overriding `optimizeDeps`). **Rules to follow**: `typescript.md` (strict typing for parsed JSON).

### Step 4: Implement Native Sync Watchers

**File**: `src/core/execution/watcher.ts` **Action**: Create **What to do**:

- Use `chokidar` to watch local dependency source directories.
- On change, trigger `rsync -avz --exclude node_modules <source> <target>` via `execa`.
- Keep track of watcher instances to cleanly close them when the pipeline stops. **Rules to follow**: `architecture-ink.md` (parallel steps).

### Step 5: Implement the Orchestrator Sequence

**File**: `src/core/execution/orchestrator.ts` **Action**: Create **Reference**: `src/core/execution/ProcessManager.ts` **What to do**:

- Create an async `runPipeline(force: boolean)` function.
- Read the store to get dependencies, sort them via `sortTopologically`.
- **Sequential Phase**: Clean -> Pre-Build (`pnpm build` if cache invalid or `force` is true) -> Install (`pnpm install`) -> Inject (via Vite wrapper).
- **Parallel Phase**: Launch `watcher.ts` instances and the dev server via `ProcessManager.spawnProcess('pnpm', ['run', devScript], 'dev')`.
- Handle errors gracefully and update `pipelineStatus` in the store. **Rules to follow**: `architecture-ink.md` (Sequential vs Parallel tasks).

### Step 6: Create Global Keybindings Hook

**File**: `src/ui/hooks/useGlobalKeybindings.ts` **Action**: Create **What to do**:

- Create a hook utilizing Ink's `useInput`.
- Extract `activeModal`, `pipelineStatus`, and target metadata from `useAppStore()`.
- Ignore inputs if `activeModal !== 'none'`.
- On `r`: if idle, call `runPipeline(false)`.
- On `f`: if idle, call `runPipeline(true)`.
- On `s`: call `processManager` to kill all active PIDs and set status to idle. **Rules to follow**: `architecture-ink.md` (Hooks must return pure data/handlers, never JSX).

### Step 7: Integrate Keybindings into App Component

**File**: `src/ui/App.tsx` **Action**: Modify **What to do**:

- Call `useGlobalKeybindings()` at the top level of the component.
- Optionally show a visual indicator in the Header or Footer when `pipelineStatus === 'running'`. **Rules to follow**: `architecture-ink.md` (Responsive Layout, pure rendering).

### Step 8: Write Comprehensive Tests

**File**: `src/core/execution/__tests__/*.test.ts` **Action**: Create **What to do**:

- Test `cache.ts` by mocking `fs` and `crypto`.
- Test `viteWrapper.ts` by mocking `fs/promises`.
- Test `watcher.ts` by mocking `chokidar` and `execa`.
- Test `orchestrator.ts` by mocking all internal phases and `ProcessManager`. **Rules to follow**: `testing-vitest.md` (100% coverage target, `vi.mock()`, `afterEach(vi.clearAllMocks)`, NEVER spawn real OS processes).

## 🔗 Step Dependencies

1. Step 1 (State) must be done first.
2. Steps 2, 3, and 4 (Core Utilities) can be implemented in parallel.
3. Step 5 (Orchestrator) depends on Steps 1, 2, 3, and 4.
4. Step 6 & 7 (UI Integration) depend on Step 5.
5. Step 8 (Tests) should be written alongside or immediately following each module (TDD).

## ✅ Validation Checklist

- [ ] TypeScript: `pnpm tsc --noEmit`
- [ ] Tests: `pnpm test src/core/execution`
- [ ] Coverage: `pnpm test --run --coverage`
- [ ] UI Interaction: Pressing `[r]` transitions the application into Running state without crashing the layout.
