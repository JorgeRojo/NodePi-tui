# Antigravity CLI - Lazy Loading Engineering Rules for NodePi-tui

This document serves as the master index for the rules and conventions adapted from the `my-kiro` repository to the `NodePi-tui` development environment.

To optimize context window and follow the lazy loading architecture, you must **NOT** guess the rules. Instead, you MUST use the `view_file` tool to read the specific rule file corresponding to your current task BEFORE executing any action in that domain.

## Global Tool Usage Rule

**CRITICAL INSTRUCTION**: You must ALWAYS prioritize using the most specific native tool available for the task at hand (e.g., `view_file`, `write_to_file`, `replace_file_content`, `grep_search`, `list_dir`) over executing generic bash commands via `run_command`.

- **NEVER** use commands like `cat`, `echo >`, `ls`, `grep`, or `sed` within a bash command.
- Only use `run_command` when there is no native tool available for the specific task (like running compilers, tests, or executing scripts).

## Lazy Loading Index

| When to load                                                                   | File to read                          |
| ------------------------------------------------------------------------------ | ------------------------------------- |
| At the start of the session or before general agent operations                 | `./.gemini/rules/agent-harnessing.md` |
| Before exploring the codebase, finding dependencies, or analyzing architecture | `./.gemini/rules/codegraph-mcp.md`    |
| Before writing or modifying React UI components, Ink layouts, or Zustand state | `./.gemini/rules/architecture-ink.md` |
| Before writing, modifying, or reviewing test files (.test.ts/.test.tsx)        | `./.gemini/rules/testing-vitest.md`   |
| When writing TypeScript types, imports, or function signatures                 | `./.gemini/rules/typescript.md`       |

**MANDATORY**: When a task involves any of the topics above, you MUST read the relevant file before acting. Multiple files may apply to a single task (e.g., if you are writing a React component with tests, you should read the architecture, testing, and typescript rules).
