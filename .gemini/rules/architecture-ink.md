# Frontend Architecture Conventions (React + Ink + Zustand)

## Purpose
Defines architectural patterns for TUI development using React, Ink, and Zustand in NodePi-tui.

## Instructions
- **Layout Engine (Ink/Yoga)**:
  - Exclusively use Ink's `<Box>` components with Flexbox properties for all layouts. Do not use manual string padding, manual line breaks, or complex string manipulations to align elements.
- **Console Output Rules**:
  - **NEVER** use `console.log`, `console.error`, or `process.stdout.write` directly in components or logic, as this breaks the Ink TUI layout. All outputs must be routed to the specific "Console Logs Panel" via state.
- **Clean State on Unmount**:
  - Screen-level components MUST clean or reset their global state (Zustand) upon unmounting to prevent memory leaks or zombie states when navigating through the TUI.
- **Separation of Logic and View**:
  - **No JSX from Hooks**: Custom Hooks (`use...`) must only return data and handlers, NEVER JSX or Ink components.
  - **Pure Data Extraction**: Core logic and helpers (`src/core/`, `utils/`) must extract and transform pure data. **Coloring (`chalk`) is strictly the responsibility of the view components**. Do not import `chalk` outside of React components.
- **State Organization (Zustand)**:
  - Divide global state into logical slices. Use a granular state file tree, not a monolithic store (e.g., one slice for logs, another for processes, another for layout).
- **Selector Taxonomy**:
  - React components should only make direct accesses to the store or consume pre-calculated selectors. Avoid inline filtering or mapping of large lists in the render cycle.
- **Performance Optimization**:
  - TUI renders can be expensive. Memoize heavy calculations. Use `useMemo` and `useCallback` appropriately to avoid unnecessary re-renders in Ink.
- **Module Structure (Dependencies)**:
  - Agnostic UI components (Buttons, Panels) -> `src/components/ui/`
  - Business logic and engines (Execa orchestrators, Chokidar watchers) -> `src/core/` or `src/services/`
  - UI components must never instantiate system processes directly; they must dispatch actions to global services provided by the core.
