# NodePi-tui: PRD Master Index

Based on the specifications, UI design, and implementation plan, the entire project is divided into the following sequential, atomic Product Requirements Documents (PRDs). Each phase depends on the successful completion of the previous one.

| ID         | Title                                  | Description                                                                                                                            | Status     |
| :--------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **PRD-01** | **Boilerplate & Testing**              | Base setup: ESM/NodeNext, Vitest + Ink testing, `pnpm` scripts, and directory scaffolding (`src/core`, `src/ui`, etc).                 | ✅ DONE    |
| **PRD-02** | **Startup Validations**                | The strict 3-step validation engine (binaries check, container paths, valid Vite project).                                             | ✅ DONE    |
| **PRD-03** | **Config Manager & Auto-Discovery**    | Read/write `.nodepirc.json`, fuzzy search `fast-glob`, and topological dependency graph sorting.                                       | ✅ DONE    |
| **PRD-04** | **Execution Engine Core**              | `execa` wrappers, PTY emulation for colored output, process group tracking (`-pid` SIGKILL), and log stream parsing.                   | ✅ DONE    |
| **PRD-05** | **State Management & Base TUI Layout** | Zustand slices setup. Ink layout (Yoga Flexbox) with Target, Dependencies, Sidebar, and Console panels. Responsive resize events.      | ✅ DONE    |
| **PRD-06** | **TUI Interactivity & Modals**         | Keyboard hooks (`[a]`, `[m]`, `[x]`), interactive `@inkjs/ui` Selectors for scripts, and dynamic mode toggling.                        | ✅ DONE    |
| **PRD-07** | **Custom Scripts Engine**              | Support for defining custom scripts in `.nodepirc.json` (type, name, terminal command) to override or augment `package.json` defaults. | ✅ DONE    |
| **PRD-08** | **Orchestration Sequence**             | Implementation of the `[r]` Run flow: clean -> pre-build -> installs -> topological builds -> inject -> cache bust -> dev server.      | ⚪ PENDING |
| **PRD-09** | **Backup & Restoration Engine**        | Pre-run physical backup of `package.json` & `node_modules`. Instant exit restoration bypassing `pnpm install`.                         | ⚪ PENDING |
