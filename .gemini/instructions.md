# Antigravity CLI - Lazy Loading Engineering Rules for NodePi-tui

This document serves as the master index for the rules and conventions adapted from the `my-kiro` repository to the `NodePi-tui` development environment.

To optimize context window and follow the lazy loading architecture, you must **NOT** guess the rules. Instead, you MUST use the `view_file` tool to read the specific rule file corresponding to your current task BEFORE executing any action in that domain.

## Lazy Loading Index

| When to load                                                                   | File to read                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| At the start of the session or before general agent operations                 | `/Users/jorge/projects/NodePi-tui/.gemini/rules/agent-harnessing.md` |
| Before writing or modifying React UI components, Ink layouts, or Zustand state | `/Users/jorge/projects/NodePi-tui/.gemini/rules/architecture-ink.md` |
| Before writing, modifying, or reviewing test files (.test.ts/.test.tsx)        | `/Users/jorge/projects/NodePi-tui/.gemini/rules/testing-vitest.md`   |
| When writing TypeScript types, imports, or function signatures                 | `/Users/jorge/projects/NodePi-tui/.gemini/rules/typescript.md`       |

**MANDATORY**: When a task involves any of the topics above, you MUST read the relevant file before acting. Multiple files may apply to a single task (e.g., if you are writing a React component with tests, you should read the architecture, testing, and typescript rules).
