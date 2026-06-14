---
name: orchestrate-dev-task
description: >
  MUST USE when the user wants to implement, develop, build, code, or program a TypeScript development task or feature based on a provided PRD. Orchestrates the creation of PRT and execution via subagents directly in the main workspace. Triggers: implementa, desarrolla, programa, codifica, hazlo.
---

# Orchestrate TypeScript Dev Task

## Purpose

Full TypeScript implementation pipeline: read provided PRD → generate PRT (Product Requirements Technical/Test) → split into tasks → determine parallelizability → implement (parallel for disjoint tasks, sequential for colliding tasks) → review.

## Instructions

### Step 1: Task Definition & Read PRD

- Parse the user's initial prompt to identify the specific PRD file they want to implement (usually located in `DOCS/TASKS/`).
- If the PRD file is not specified, ask the user to provide it before continuing.
- Use `view_file` to read the contents of the specified PRD file to understand the task requirements.

### Step 2: Generate PRT

- Use `invoke_subagent` with `TypeName: "self"`, `Role: "PRT Generator"`, and `Workspace: "inherit"`.
- **MANDATORY**: Read the prompt from `.gemini/prompts/prt-generator.md` and pass it to the subagent along with the path to the specified PRD file in `DOCS/TASKS/`.
- **CRITICAL**: Instruct the subagent that while the provided PRD has the highest priority, the subagent MUST also explore and utilize the full project context, all relevant documentation, and the `.gemini/rules/` of the project to properly calculate and generate the PRT.
- The subagent must save the PRT in the `/Users/jorge/projects/NodePi-tui/DOCS/TASKS/` directory.
- **STOP HERE. Ask the user to review the PRT before proceeding.**
- Wait for user confirmation. Do NOT proceed to Step 3 until the user explicitly confirms.

### Step 3: Analyze, Split & Plan Execution

- Only after user confirmation.
- Analyze the `Implementation Steps` from the PRT.
- Group the implementation steps into atomic tasks:
  1. **Parallelizable Tasks**: Tasks that target completely disjoint sets of files and have no mutual dependencies.
  2. **Sequential Tasks**: Tasks that target overlapping files, or where one task depends on another, MUST be run sequentially.
- Print the execution plan to the user clearly specifying phases and file scopes.

### Step 4: Implement Tasks

- Implement the tasks group by group according to the execution phases.
- For parallel phases:
  - Launch multiple subagents using `invoke_subagent` (max 4 concurrent).
  - **MANDATORY**: `Workspace: "inherit"` must be set for every subagent.
  - **MANDATORY**: Read the prompt from `.gemini/prompts/dev-implementer.md` and pass it to each subagent along with their specific task derived from the PRT.
  - Wait for all parallel subagents to complete and collect their dev reports via messages.
- For sequential phases:
  - Launch subagents one after another, waiting for each to finish before launching the next.
- If any task execution fails or returns an error, halt the pipeline and report the issue to the user.

### Step 5: Stage changes

- Once implementation is done, stage all modified files: `git add [list of files]` using the `run_command` tool.
- NEVER stage `package.json`, `pnpm-lock.yaml`, or files outside the strict scope of the ticket unless required by the PRT.

### Step 6: Self-review

- Use `invoke_subagent` with `TypeName: "self"`, `Role: "Code Reviewer"`, and `Workspace: "inherit"`.
- **MANDATORY**: Read the prompt from `.gemini/prompts/code-reviewer.md` and pass it to the subagent to review the staged changes.
- If the reviewer verdict is BLOCKED (critical issues found), enter a fix loop:
  1. Launch a Dev subagent (`Workspace: "inherit"`) to fix the issues.
  2. Re-stage files.
  3. Re-run the Code Reviewer.
  4. Repeat up to 3 times maximum.

### Step 7: Update PRD Index

- Once the implementation and self-review are successfully completed, use the `replace_file_content` tool to update the `/Users/jorge/projects/NodePi-tui/DOCS/TASKS/PRD-INDEX.md` file.
- Change the status of the implemented PRD to done/completed (e.g., from `⚪ PENDING` to `✅ DONE`).

### Step 8: Final Report

- Print to the user a final summary:
  ```text
  ✅ Implementation complete for [Task/Ticket]
  🔀 Execution Plan used: [Sequential / Parallel]
  🔍 Self-review: [APPROVED]
  🔄 Review iterations: [N]
  ```
