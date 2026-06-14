# General Agent Rules (Harnessing & Safety)

## Purpose

Defines the safe operational boundaries, package manager, and artifact usage for the Antigravity CLI agent in the NodePi-tui project.

## Instructions

- **Language**: Respond in the language in which the user starts the conversation (Spanish by default). Documentation, code comments, and variable/function names must ALWAYS be written in **English**.
- **Package Manager**:
  - **MANDATORY**: Exclusively use `pnpm` for any dependency installation or script execution (e.g., `pnpm add`, `pnpm dev`). NEVER use `npm` or `yarn`.
- **Environment**:
  - The project natively targets **macOS and Linux**. Do not apply Windows-specific path conversions or logic unless explicitly requested.
- **Shell Safety**:
  - **NEVER** use commands like `cat`, `ls`, `grep`, or `sed` within bash commands. ALWAYS use the specific native agent tools (`view_file`, `list_dir`, `grep_search`, `replace_file_content`, `multi_replace_file_content`).
  - Asynchronous commands running in the background (`watch`, `dev`) must be carefully managed and killed using their PID or through the agent's task management tools to avoid leaving orphan processes.
- **Artifacts**: All reports, summaries, and generated code for review must be written as "Artifacts" in the persistent directory assigned by the system. Do not reuse artifacts from previous sessions.
- **Memory and Volatile State**: Do not store volatile data in persistent documentation. Document architectural findings in the `DOCS/` folder.
