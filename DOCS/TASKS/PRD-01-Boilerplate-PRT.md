# PRT: 01-Boilerplate

## Overview

PRD: `/Users/jorge/projects/NodePi-tui/DOCS/TASKS/PRD-01-Boilerplate.md`
This task focuses on configuring the foundational ESM/TypeScript setup for the NodePi TUI project. It will involve establishing the entry point scripts, creating a base React/Ink component for rendering, and configuring the Vitest framework to ensure tests pass in a headless TUI environment, applying all the workspace rules.

## 🔍 Codebase Analysis

- **Context**: `package.json` contains necessary dependencies (`ink-testing-library`, `vitest`, `tsx`, `ink`, `react`, etc.) and basic script definitions. `tsconfig.json` is correctly set to `NodeNext` for module and moduleResolution. `src/` directories exist but are empty.
- **Rules Applied**:
  - `typescript.md`: Relative imports MUST include the `.js` extension (e.g., `import { App } from './ui/App.js'`), explicit types, no `any`.
  - `architecture-ink.md`: The main component should use `<Box>` and/or `<Text>` from Ink. No `console.log` for output.
  - `testing-vitest.md`: `vi.fn()` instead of `jest.fn()`, `afterEach(vi.clearAllMocks)` usage, and `render` from `ink-testing-library` for assertions like `lastFrame()`. Target minimum 80% UI coverage.
  - `agent-harnessing.md`: Use `pnpm` exclusively for any package-related commands.

## 📁 Scope of Changes

- ✨ `src/ui/App.tsx` — Create
- ✨ `src/index.tsx` — Create
- ✨ `src/__tests__/App.test.tsx` — Create

## 📋 Implementation Steps

### Step 1: Create the Root UI Component

**File**: `src/ui/App.tsx`
**Action**: Create
**Reference**: `architecture-ink.md`
**What to do**:

- Import `React` from `react`.
- Import `{ Text, Box }` from `ink`.
- Create a functional component `App` that returns a `<Box>` containing a `<Text>` element with the string `NodePi Initialization...`.
- Apply a basic color via Ink's native color props (e.g., `<Text color="green">NodePi Initialization...</Text>`).
  **Rules to follow**: `typescript.md` (Strict typings, ESM `.js` imports for any internal components later), `architecture-ink.md` (Use Ink components).

### Step 2: Create the CLI Entrypoint

**File**: `src/index.tsx`
**Action**: Create
**Reference**: `typescript.md`
**What to do**:

- Add the `#!/usr/bin/env node` shebang at the top.
- Import `React` from `react`.
- Import `{ render }` from `ink`.
- Import the `App` component from `./ui/App.js` (Crucial: use the `.js` extension).
- Execute `render(<App />)`.
  **Rules to follow**: `typescript.md` (NodeNext ESM imports), `agent-harnessing.md` (macOS/Linux executable paths).

### Step 3: Implement Unit Tests for the Base Component

**File**: `src/__tests__/App.test.tsx`
**Action**: Create
**Reference**: `testing-vitest.md`
**What to do**:

- Import `React` from `react`.
- Import `{ render }` from `ink-testing-library`.
- Import `{ describe, it, expect, afterEach, vi }` from `vitest`.
- Import the `App` component from `../ui/App.js`.
- Add an `afterEach` hook calling `vi.clearAllMocks()`.
- Write a test suite verifying that `render(<App />)` correctly outputs the expected text. Use `lastFrame()` to verify `NodePi Initialization...` is present.
  **Rules to follow**: `testing-vitest.md` (TDD, test headless Ink rendering, use `vitest`), `typescript.md` (ESM imports).

## 🔗 Step Dependencies

- **Step 1** (`App.tsx`) must be completed before **Step 2** (`index.tsx`) and **Step 3** (`App.test.tsx`), since both rely on the existence of the `App` component.

## ✅ Validation Checklist

- [ ] TypeScript: `pnpm tsc --noEmit`
- [ ] Tests: `pnpm test`
- [ ] Execution Check: `pnpm dev` executes without errors and renders the placeholder component.
- [ ] Build Check: `pnpm build` generates the `dist/` folder with valid `.js` ESM files.
