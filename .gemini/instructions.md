# Antigravity CLI - Harnessing Engineering Rules for NodePi-tui

This document adapts the rules and conventions from the `my-kiro` repository to the `NodePi-tui` development environment, optimized for the Antigravity CLI agent.

## 1. General Agent Rules (Harnessing & Safety)

- **Language**:
  - Always respond in the language in which the user starts the conversation (Spanish by default).
  - **Documentation, code comments, and variable/function names** must ALWAYS be written in **English**.
- **Shell Safety**:
  - **NEVER** use commands like `cat`, `ls`, `grep`, or `sed` within bash commands. ALWAYS use the specific native agent tools (`view_file`, `list_dir`, `grep_search`, `replace_file_content`).
  - Do not initiate web searches (e.g., `search_web`) or network calls unless explicitly requested by the user or if necessary to query library documentation in Context7.
  - Asynchronous commands running in the background (`watch`, `dev`) must be carefully managed and killed using their PID or through the agent's task management tools to avoid leaving orphan processes.
- **Artifacts**:
  - All reports, summaries, and generated code for review must be written as "Artifacts" in the persistent directory assigned by the system.
  - Do not reuse artifacts generated in previous sessions to avoid dragging outdated context.
- **Memory and Volatile State**:
  - Do not store volatile data (such as temporary PIDs, row counts, or ephemeral logs) in persistent documentation.
  - Document architectural findings and design patterns in the `DOCS/` folder.

## 2. Frontend Architecture Conventions (React + Ink)

Adaptation of "Archifront" architecture rules to the Ink console environment:

- **Clean State on Unmount**:
  - Screen-level components MUST clean or reset their global state (Zustand) upon unmounting to prevent memory leaks or zombie states when navigating through the TUI.
- **Separation of Logic and View**:
  - **No JSX from Hooks**: Custom Hooks (`use...`) must only return data and handlers, NEVER JSX or Ink components. Extract the logic to a separate component if rendering is needed.
  - **Pure Data Extraction**: Helpers (`utils/`) must extract and transform pure data without worrying about presentation (e.g., without `chalk` color formatting). Coloring is the responsibility of the view.
- **State Organization (Zustand)**:
  - The global state must be divided into logical "slices". The state file tree should be granular and not a single monolithic store. One slice for logs, another for processes, another for layout.
- **Selector Taxonomy**:
  - If a selector requires complex logic (projections, reductions), extract it outside the component. React components should only make direct accesses to the store or consume pre-calculated selectors.

## 3. Testing and Code Quality

- **Test-Driven Development (TDD)**:
  - **ALWAYS use Test-Driven Development (TDD).** You must write the tests before implementing any functional code or UI component. Every feature, helper, and component must have complete test coverage.
- **Test Structure (Vitest)**:
  - Critical validations (such as dependency cleanup or injection failures) must be tested assuming various error scenarios (404 error from package.json, lack of permissions, rsync failure).
  - **Environment Restoration**: Use the `afterEach` hook in tests to restore the environment to its original state.
- **Strict Typing (TypeScript)**:
  - Use the types provided by the base libraries (e.g., `BoxProps` from Ink). It is strictly FORBIDDEN to type data as `any`.

## 4. Module Structure (Dependencies)

- **Package Dependency Flow**:
  - Agnostic UI components (Buttons, Selectors, Inputs) -> `src/components/ui/`
  - Business logic and engines (Execa, Chokidar) -> `src/core/` or `src/services/`
  - UI components must never instantiate system processes directly; they must use global services provided by the core.
