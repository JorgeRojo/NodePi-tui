# CodeGraph MCP Usage Rules

## Purpose

Defines how the agent should use the CodeGraph MCP tools to explore, understand, and analyze the codebase efficiently.

## Instructions

- **MANDATORY**: The project is indexed with `codegraph`. Whenever you need to explore the codebase, search for functions, analyze dependencies, or understand the architecture, you MUST use the `codegraph` MCP tools.
- **Save Tokens**: Use CodeGraph queries instead of manually grepping or reading large numbers of files to find structural relationships or usage examples.
- **Index Health**: If the `.codegraph` directory does not exist, use the `run_command` tool to run `npx codegraph init`. If it does exist, run `npx codegraph sync` to ensure the index is up to date before running queries.
- **Subagents**: When delegating codebase exploration tasks to subagents (like PRT Generators, Code Reviewers, or Dev Implementers), ensure they are instructed to leverage the `codegraph` MCP tools.
