---
name: auto-commit
description: Analyze staged changes, select a Conventional Commit prefix, generate a concise title, and execute the git commit command upon user confirmation. Triggers: commit, push changes, create commit.
---

# Git Commit Title Generator & Executor

**STRICT TRIGGER RULE**: This skill MUST ONLY be initiated when the user explicitly requests a commit (e.g., "commit this", "wrap up this task", "perform a commit"). NEVER suggest or trigger this skill autonomously after research or implementation tasks unless specifically asked to do so.

This skill guides the agent in analyzing the Git staged area (`git diff --staged` or `git diff --cached`) to generate a professional commit title and perform the commit.

## Decision Logic

When generating a title, the agent **MUST** choose the most accurate prefix from the following list:

| Prefix         | Use Case                                                                                           |
| :------------- | :------------------------------------------------------------------------------------------------- |
| **`feat`**     | A new feature for the user, not a new feature for internal build.                                  |
| **`fix`**      | A bug fix.                                                                                         |
| **`docs`**     | Documentation only changes (README, DOCS/, memory-bank, etc.).                                     |
| **`style`**    | Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc).         |
| **`refactor`** | A code change that neither fixes a bug nor adds a feature.                                         |
| **`perf`**     | A code change that improves performance.                                                           |
| **`test`**     | Adding missing tests or correcting existing tests.                                                 |
| **`build`**    | Changes that affect the build system or external dependencies (e.g., package.json, tsconfig.json). |
| **`ci`**       | Changes to CI configuration files and scripts (e.g., github workflows).                            |
| **`chore`**    | Other changes that don't modify src or test files (e.g., .gitignore, tool configuration).          |

## Generation Rules

1.  **Analyze Scope**: Identify the primary module or domain affected (e.g., `core/validator`, `wizard`, `docs`).
2.  **Conciseness**: Keep the title under **72 characters**.
3.  **Imperative Mood**: Use the present tense, imperative mood (e.g., "Add feature", "Fix bug").
4.  **Format**: `<prefix>(<scope>): <short description>`

## Analysis & Execution Workflow

1.  **Verify Staged Area**: Run `git diff --cached --stat`. If nothing is staged, tell the user and STOP.
2.  **Read Staged Changes**: Run `git diff --cached` (or `git diff --staged`).
3.  **Select Prefix & Generate Title**: Based on the analysis of the nature of the changes.
4.  **Propose & Execute**: Propose the generated title to the user. Upon confirmation, execute: `git commit -m "[generated title]"`.
5.  **Prominent Display**: After a successful commit, display the final commit message in a highly visible manner (e.g., using a code block, bold text) to ensure it is the most prominent element in the final response.
