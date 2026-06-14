# PRT: Config Manager

## Overview

PRD: `./DOCS/TASKS/PRD-03-Config-Manager.md`

The Config Manager will act as the core engine for NodePi-tui's configuration lifecycle. It involves creating a set of utilities in `src/core/config-manager/` to handle strictly typed read/write operations for `.nodepirc.json`, discovering dependencies using `fast-glob`, running AI-inferred script resolution via `agy` using `execa`, and sorting the final dependency list topologically. The design strictly isolates business logic from the view and Zustand state (which will be integrated in PRD-05).

## 🔍 Codebase Analysis

- **Reference Files Examined**: `src/core/validators/configValidator.ts` (currently uses `fs/promises` and `path`, though it improperly uses `chalk` which violates the pure-data logic rule).
- **Rules Applied**:
  - `typescript.md`: NodeNext relative imports (must use `.js`), strict validation of parsed JSON, no `any`.
  - `architecture-ink.md`: No `chalk` or console outputs in the core logic. Pure data extraction only.
  - `testing-vitest.md`: TDD required. Absolute mocking of `fs/promises` and `execa`.
  - `agent-harnessing.md`: Use `pnpm` exclusively.

## 📁 Scope of Changes

- ✨ `src/core/config-manager/types.ts` — Create interfaces for Configuration and Package metadata.
- ✨ `src/core/config-manager/io.ts` — Create read/write persistence logic.
- ✨ `src/core/config-manager/discovery.ts` — Create dependency discovery via globbing.
- ✨ `src/core/config-manager/inference.ts` — Create Agy AI script resolution using `execa`.
- ✨ `src/core/config-manager/sorter.ts` — Create the topological sorting algorithm.
- ✨ `src/core/config-manager/index.ts` — Centralized exports.
- ✨ `src/core/config-manager/__tests__/io.test.ts` — Create tests.
- ✨ `src/core/config-manager/__tests__/discovery.test.ts` — Create tests.
- ✨ `src/core/config-manager/__tests__/inference.test.ts` — Create tests.
- ✨ `src/core/config-manager/__tests__/sorter.test.ts` — Create tests.

## 📋 Implementation Steps

### Step 1: Define Types

**File**: `src/core/config-manager/types.ts` **Action**: Create **What to do**: Export strict interfaces: `NodePiConfig` (containing `containers: string[]`), `PackageMetadata` (`name`, `version`, `dependencies`, `devDependencies`, `scripts`), and `AgyInferenceResult`. **Rules to follow**: `typescript.md` (No `any`, explicit typing).

### Step 2: Implement Config I/O & Tests

**Files**: `src/core/config-manager/io.ts`, `src/core/config-manager/__tests__/io.test.ts` **Action**: Create **What to do**: Implement `readConfig(basePath: string): Promise<NodePiConfig>` and `writeConfig(basePath: string, config: NodePiConfig): Promise<void>`. Handle missing files gracefully by returning/writing a default template instead of throwing. **Rules to follow**: `testing-vitest.md` (Mock `fs/promises`, TDD). `typescript.md` (Validate parsed JSON fields, `.js` imports for internal helpers).

### Step 3: Implement Dependency Discovery

**Files**: `src/core/config-manager/discovery.ts`, `src/core/config-manager/__tests__/discovery.test.ts` **Action**: Create **What to do**: Implement `discoverDependencies(containers: string[]): Promise<PackageMetadata[]>`. Use `fast-glob` to scan `package.json` inside the specified container directories (e.g. `${container}/**/package.json`). Read and parse each `package.json` to extract `name`, `version`, `dependencies`, and `devDependencies`. **Rules to follow**: `architecture-ink.md` (Pure data return, no logs). `testing-vitest.md` (Mock `fast-glob` and `fs/promises`).

### Step 4: Implement AI Script Inference

**Files**: `src/core/config-manager/inference.ts`, `src/core/config-manager/__tests__/inference.test.ts` **Action**: Create **What to do**: Implement `inferScripts(packageJsonContent: string): Promise<AgyInferenceResult>`. Use `execa` to spawn `agy --model gemini-1.5-flash --print ...` and pass the package JSON content to dynamically infer `dev`, `build`, and `watch` scripts. Parse the `stdout` from `agy` as JSON and strictly validate its shape. **Rules to follow**: `testing-vitest.md` (CRITICAL: mock `execa` to prevent real AI calls during unit tests).

### Step 5: Implement Topological Sorter

**Files**: `src/core/config-manager/sorter.ts`, `src/core/config-manager/__tests__/sorter.test.ts` **Action**: Create **What to do**: Implement `sortTopologically(packages: PackageMetadata[]): PackageMetadata[]`. Map the dependencies to build an adjacency list. Implement a Kahn's or DFS-based topological sort to ensure that if Package A depends on Package B, B is positioned before A in the resulting array. Detect and throw an error on circular dependencies. **Rules to follow**: `typescript.md` (Explicit return types, strict typing).

## 🔗 Step Dependencies

1. **Step 1** (Types) must be completed first as all other steps rely on them.
2. **Steps 2, 3, 4, and 5** can be implemented sequentially or in parallel, but tests must be written concurrently with their respective files.

## ✅ Validation Checklist

- [ ] TypeScript: `pnpm tsc --noEmit`
- [ ] Tests: `pnpm vitest run src/core/config-manager`
