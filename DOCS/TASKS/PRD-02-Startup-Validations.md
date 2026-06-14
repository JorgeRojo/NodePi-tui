# PRD: 02-Startup-Validations

## Overview

Before the TUI mounts and draws the layout, NodePi must verify the environment is sound. This PRD details the three-step strict validation engine executed on boot. If any validation fails, the TUI gracefully falls back to a printed error rather than a runtime crash.

## 🎯 Objectives

- Ensure all necessary system binaries (`node`, `rsync`, `git`, `pnpm`) are available.
- Validate that the target workspace is a Vite/Node project.
- Validate that global container directories are properly configured.

## 📋 Functional Requirements

- **Step 1 (System Tools)**: Attempt to resolve versions of `pnpm`, `rsync`, and `git` via `execa` in the PATH. If missing, throw an actionable error. Note: `watch` and `shasum` are no longer needed as they are handled natively.
- **Step 2 (Global Config)**: Verify `~/.nodepirc.json` exists, contains a `containers` array with at least 1 path, and ensure paths resolve under the user's home directory (`~/`).
- **Step 3 (Target Integrity)**: Statically check `process.cwd()`. It must contain `package.json` and a Vite configuration file (e.g., `vite.config.ts`, `vite.config.js`). **Crucial**: No target scripts must be executed during this step.

## 🚫 Out of Scope

- Checking the integrity or versions of dependencies inside the target's `node_modules`.

## ✅ Acceptance Criteria

- Starting `pnpm dev` in an empty folder clearly prints an error: "Not a valid Vite project."
- If `rsync` is uninstalled or aliased poorly, it prints "System dependency missing: rsync."
- Validations execute sequentially before React/Ink mounts the dashboard.

## 🔧 Technical Requirements

- Utilize pure asynchronous helper functions in `src/core/validators/`.
- Use `fs/promises` for static checks (checking file existence).
- Error outputs must use `chalk` for color-coding warnings and errors.
