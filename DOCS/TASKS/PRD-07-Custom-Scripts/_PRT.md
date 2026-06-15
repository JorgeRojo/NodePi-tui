# PRT: Custom Scripts Engine

## Overview

PRD: `DOCS/TASKS/PRD-07-Custom-Scripts/PRD-07-Custom-Scripts.md` Implement a Custom Scripts Engine that enables users to define, save, and execute custom terminal commands via the TUI, persisting them locally in `.nodepirc.json`. The execution engine is upgraded to bypass `pnpm run` and spawn raw shell commands safely to support operators like `&&` or `|`.

## 🔍 Codebase Analysis

- **Configuration (`src/core/config-manager/*`, `src/core/validators/*`)**: The `NodePiConfig` structure, read/write logic (`io.ts`), and `configValidator.ts` must be extended to parse and validate a `customScripts` array.
- **State (`src/store/appStore.ts`)**: `AppState` requires a `customScripts` list, a new `activeModal` state (`'scripts'`), and an `addCustomScript` action that synchronously updates `io.ts`.
- **Execution (`src/core/execution/ProcessManager.ts`)**: `ProcessManager.spawnProcess` currently forces `script -q /dev/null cmd ...args`. To support composite custom scripts, we need a way to execute via `sh -c` inside the pseudo-terminal.
- **UI (`src/ui/*`)**: A new interactive `ScriptsModal.tsx` is required, mapping an `[S]` (Shift+s) keypress in the `DependencyList` to prompt the user via `@inkjs/ui` for script Type, Name, and Command.
- **Rules Applied**: Strict ESM NodeNext imports (`.js`), TDD mandatory (Vitest mock `execa`), functional React hooks returning no JSX, layouts using solely Ink `<Box>`.

## 📁 Scope of Changes

- ✨ `src/ui/components/ScriptsModal.tsx` — Create
- ✏️ `src/core/config-manager/types.ts` — Modify
- ✏️ `src/core/validators/configValidator.ts` — Modify
- ✏️ `src/core/config-manager/io.ts` — Modify
- ✏️ `src/store/appStore.ts` — Modify
- ✏️ `src/ui/App.tsx` — Modify
- ✏️ `src/ui/components/DependencyList.tsx` — Modify
- ✏️ `src/ui/components/Footer.tsx` — Modify
- ✏️ `src/core/execution/ProcessManager.ts` — Modify

## 📋 Implementation Steps

### Step 1: Update Configuration Schema

**File**: `src/core/config-manager/types.ts` **Action**: Modify **What to do**:

- Export a new `CustomScript` interface defining: `type: string`, `name: string`, `command: string`.
- Add an optional property `customScripts?: CustomScript[]` to the `NodePiConfig` interface. **Rules to follow**: TypeScript Rules - Strict typings, no `any`.

### Step 2: Validate the New Config (TDD)

**File**: `src/core/validators/configValidator.ts` **Action**: Modify **What to do**:

- Add validation logic for the `customScripts` array.
- Ensure every element is an object and `type`, `name`, and `command` are strings.
- Throw a specific error wrapped in `chalk.red()` if validation fails. **Rules to follow**: Testing Rules - Update `configValidator.test.ts` first. TypeScript Rules - Explicit validations and null checks before accessing parsed JSON properties.

### Step 3: Implement Config I/O (TDD)

**File**: `src/core/config-manager/io.ts` **Action**: Modify **What to do**:

- Update `readConfig` to parse and extract the `customScripts` array.
- Update `defaultTemplate` to default to an empty array for `customScripts` (or omit safely). **Rules to follow**: Testing Rules - Update `io.test.ts` first.

### Step 4: Update Zustand Store

**File**: `src/store/appStore.ts` **Action**: Modify **What to do**:

- Introduce `customScripts: CustomScript[]` to `AppState`.
- Add `'scripts'` to the union type of `activeModal`.
- Create an action `addCustomScript: (script: CustomScript) => void` that appends the script and fires `writeConfig`. **Rules to follow**: TypeScript Rules - `io.js` import must include the extension. Do not mutate state directly; return a new partial state object.

### Step 5: Process Manager Shell Execution

**File**: `src/core/execution/ProcessManager.ts` **Action**: Modify **What to do**:

- Add a new method `spawnShellProcess(name: string, commandString: string, type: ProcessType)` (or update `spawnProcess` to detect shell context).
- This method should spawn `execa('script', ['-q', '/dev/null', 'sh', '-c', commandString], ...)` to support logical operators (`&&`, `|`) while maintaining PTY emulation. **Rules to follow**: Testing Rules - Mock `execa` in `ProcessManager.test.ts` to verify the exact arguments passed.

### Step 6: Create Scripts Modal Component

**File**: `src/ui/components/ScriptsModal.tsx` **Action**: Create **Reference**: `src/ui/components/AddDependencyModal.tsx` **What to do**:

- Build a multi-step form utilizing `@inkjs/ui` components (`Select` and `TextInput`).
- Sequence: Select Type (e.g., `pre-build`, `build`, `dev`, `watch`) -> Input Name -> Input Command.
- On complete, trigger `addCustomScript` and close the modal (`setActiveModal('none')`). **Rules to follow**: Architecture-Ink - Exclusively use `<Box>` and Flexbox. Do not use `console.log`.

### Step 7: Integrate UI Components & Keybindings

**Files**: `src/ui/App.tsx`, `src/ui/components/DependencyList.tsx`, `src/ui/components/Footer.tsx` **Action**: Modify **What to do**:

- **App.tsx**: Conditionally render `<ScriptsModal />` when `activeModal === 'scripts'`.
- **DependencyList.tsx**: Add an Ink `useInput` binding for `'S'` (Shift+s) to trigger `setActiveModal('scripts')`.
- **Footer.tsx**: Add `[S] Scripts` to the key legend. **Rules to follow**: Ensure the UI degrade properly gracefully if terminal size requirements aren't met.

## 🔗 Step Dependencies

- **Step 1** is the foundation.
- **Steps 2, 3, and 4** build upon Step 1 sequentially.
- **Step 5** can be tackled concurrently but must be merged before orchestrator logic invokes custom scripts.
- **Steps 6 and 7** finalize the UI integration after store updates.

## ✅ Validation Checklist

- [ ] TypeScript: `pnpm tsc --noEmit`
- [ ] Tests: `pnpm vitest run src/core/config-manager/__tests__/io.test.ts`
- [ ] Tests: `pnpm vitest run src/core/validators/__tests__/configValidator.test.ts`
- [ ] Tests: `pnpm vitest run src/core/execution/__tests__/ProcessManager.test.ts`
- [ ] Tests: Ensure Ink UI renders are validated using `ink-testing-library` in appropriate test files.
