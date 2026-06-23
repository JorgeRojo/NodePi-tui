# Testing Rules (Vitest)

## Purpose

Establishes testing standards for React-Ink components, logic services, and test preservation using Vitest.

## Instructions

- **Test-Driven Development (TDD)**: ALWAYS use TDD. Write tests before implementing any functional code or UI component. Every feature, helper, and component must have complete test coverage.
- **Test Preservation Protocol**:
  - Examine existing tests before modifying them.
  - NEVER delete existing tests without a clear, documented justification.
  - MANDATORY: ADD new tests, preserve original tests.
  - **Style Consistency**: Before writing any test, examine similar test files in the codebase (same directory → same module/file type) to adopt consistent structures, mock patterns, and setup functions.
- **Structure & Execution**:
  - Use `afterEach(vi.clearAllMocks)` for concise cleanup when using mocks.
  - **Environment Restoration**: Use `afterEach` to restore the environment (e.g., clearing mocked filesystem state or background processes).
- **Mocking (Vitest Specifics)**:
  - Use `vi.fn()` and `vi.mock()` instead of `jest.fn()` / `jest.mock()`.
  - **CRITICAL**: Always mock external Node modules (`execa`, `chokidar`, `fs`, `fs/promises`) when testing core logic to absolutely guarantee tests never spawn real OS processes or alter real files.
  - **Over-Mocking Prevention**:
    - DO NOT mock utility functions that are pure (no side effects).
    - NEVER mock constants, enums, or static config objects — let them run with real values.
    - Do not mock modules/functions that the component/file under test does not import or use directly.
    - Every mock configured with `mockReturnValue` or `mockImplementation` MUST have a corresponding assertion (e.g., `toHaveBeenCalled`).
  - Use specific types for mocks (`MockedFunction<typeof fn>`), never `any`.
- **Function Call Verification**:
  - Every `toHaveBeenCalledWith` assertion MUST be preceded by a `toHaveBeenCalledTimes` assertion on the same mock to ensure the mock was called the expected number of times, not just that one of N calls matched.
- **TUI Component Testing**:
  - Use `ink-testing-library` (`render`) to test Ink components.
  - Test the resulting output structure by asserting against `lastFrame()` strings, ensuring formatting and colors are applied correctly.
- **Coverage Requirements**:
  - Target 100% coverage for core logic (execa orchestrators, state slices).
  - Target 80% minimum coverage for UI components.
