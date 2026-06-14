# PRD: 01-Boilerplate

## Overview
This task establishes the foundational skeleton of the NodePi TUI project. It sets up the strict TypeScript environment, the build process for ESM (NodeNext), the Vitest testing suite (including headless Ink testing), and the base entry points. This guarantees a solid, testable foundation before implementing complex system logic or UI.

## 🎯 Objectives
- Configure a robust, strict TypeScript environment tailored for `ESM` (`NodeNext`).
- Set up `vitest` for unit testing and headless UI rendering (`@inkjs/testing`).
- Configure development execution (`tsx`).
- Create the fundamental `src/` directory scaffolding.
- Ensure strict formatting and linting scripts (`eslint`/`prettier` via `pnpm`).

## 📋 Functional Requirements
- **Execution**: The project must be runnable in development mode via `pnpm dev` without requiring a pre-build step.
- **Building**: Building the project (`pnpm build`) must compile the TypeScript code to an executable ESM output in `dist/`.
- **Testing**: The testing suite (`pnpm test`) must run with Vitest and support React/Ink component rendering tests.
- **Bootstrapping**: A basic placeholder Ink component must render "NodePi Initialization" to confirm the UI pipeline and React mount works.

## 🚫 Out of Scope
- Actual implementation of the `execa` execution engine.
- Configuration persistence or reading `.nodepirc.json`.
- UI panels, sidebars, or responsive logic.
- Startup environment validations (Checking for node, rsync, etc.).

## ✅ Acceptance Criteria
- Running `pnpm build` generates the `dist/` folder with valid `.js` ESM files.
- Running `pnpm test` executes successfully without errors.
- Running `pnpm dev` prints the basic placeholder Ink component to the terminal and exits cleanly.
- `package.json` correctly defines `"type": "module"` and the binary entrypoint `"bin": { "nodepi": "./dist/index.js" }`.

## 🎨 UI/UX Specifications
- A single `<Text>` component rendering the string: `NodePi Initialization...` with a basic color applied via Chalk or Ink's native color props.

## 🔧 Technical Requirements
- Node.js >= 20.11.0 constraint in `package.json`.
- `tsconfig.json` must be strictly set for `"moduleResolution": "NodeNext"` and `"module": "NodeNext"`.
- Directories to create:
  - `src/core/` (Orchestration, Execution Engines, Validators)
  - `src/ui/` (React Ink components, hooks)
  - `src/store/` (Zustand state slices)
  - `src/utils/` (Pure helpers)
  - `src/__tests__/` (Global tests, though co-located tests `*.test.tsx` are also permitted)
- Required `pnpm` dependencies to define (if not already present): `ink`, `react`, `vitest`, `@inkjs/testing`.
