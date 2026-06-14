# PRD: 09-Backup-Restore

## Overview
To guarantee workspace safety, NodePi must never leave corrupted dependencies, injected JSON values, or orphaned processes if the user exits abruptly. This PRD implements the backup and instant-exit engine.

## 🎯 Objectives
- Perform physical backups of `node_modules` and configs before injection.
- Instantly restore backups upon stopping or exiting the application.
- Intercept OS signals to guarantee execution.

## 📋 Functional Requirements
- **Backup Phase**: Before PRD-08 injects anything, copy `package.json`, `pnpm-lock.yaml`, and `node_modules/<dep>` to `.nodepi-backup/`.
- **Restore Phase**: Copy the backups back to their original locations. Delete `.vite.config.nodepi.ts`.
- **Instant Exit**: Because we physically restore files instead of running `pnpm install`, restoration takes milliseconds.
- **Signal Handlers**: Listen to `SIGINT` (Ctrl+C), `SIGTERM`, and `process.on('uncaughtException')`.

## ✅ Acceptance Criteria
- Pressing `Ctrl+C` while the dev server is running immediately kills all process groups (no orphan Vite servers).
- After exit, inspecting the target's `package.json` shows it clean without any `"injected": true` modifications.
- After exit, `node_modules` is perfectly restored to its pre-run state.

## 🔧 Technical Requirements
- Use fast `fs/promises` `cp` (copy) methods with `{ recursive: true }`.
- Ensure signal handlers are registered early in the application lifecycle (in `src/index.ts`).
- Avoid async operations inside exit handlers if possible, or use `process.exit()` immediately after awaiting the critical restore function.
