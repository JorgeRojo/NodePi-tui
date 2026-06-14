# General Agent Rules (Harnessing & Safety)

## Purpose

Defines the safe operational boundaries, package manager, and artifact usage for the Antigravity CLI agent in the NodePi-tui project.

## Instructions

- **Language**: Respond in the language in which the user starts the conversation (Spanish by default). Documentation, code comments, and variable/function names must ALWAYS be written in **English**.
- **Package Manager**:
  - **MANDATORY**: Exclusively use `pnpm` for any dependency installation or script execution (e.g., `pnpm add`, `pnpm dev`). NEVER use `npm` or `yarn`.
  - **MANDATORY**: Before installing any new dependency, you MUST ALWAYS query its documentation using the `context7` MCP tools (`resolve-library-id` and `query-docs`) to ensure you are following the latest best practices and configuration.
- **Environment**:
  - The project natively targets **macOS and Linux**. Do not apply Windows-specific path conversions or logic unless explicitly requested.
- **Shell Safety**:
  - **NEVER** use commands like `cat`, `ls`, `grep`, or `sed` within bash commands. ALWAYS use the specific native agent tools (`view_file`, `list_dir`, `grep_search`, `replace_file_content`, `multi_replace_file_content`).
  - Asynchronous commands running in the background (`watch`, `dev`) must be carefully managed and killed using their PID or through the agent's task management tools to avoid leaving orphan processes.
- **Artifacts**: All reports, summaries, and generated code for review must be written as "Artifacts" in the persistent directory assigned by the system. Do not reuse artifacts from previous sessions.
- **Memory and Volatile State**: Do not store volatile data in persistent documentation. Document architectural findings in the `DOCS/` folder.

## AI Automation & Script Inference

- **Agy Integration**: If script configuration (e.g., build, watch, dev) is missing for a package in `.nodepirc.json`, the agent must first attempt to use the `agy --model gemini-1.5-flash` command to infer the scripts from `package.json` before prompting the user with an interactive selector.
