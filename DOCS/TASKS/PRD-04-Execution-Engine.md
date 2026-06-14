# PRD: 04-Execution-Engine

## Overview
This task implements the core process spawner. Unlike the Electron version which relied on generic bash scripts and `killall` commands, NodePi-tui uses precise native Node.js process management via `execa` and process groups.

## 🎯 Objectives
- Build a robust `ProcessManager` singleton or Zustand slice that tracks running processes.
- Implement PTY emulation wrappers to preserve terminal colors (e.g., Vite/tsc colors).
- Ensure 100% clean process termination using negative PIDs (`SIGKILL` to process groups).

## 📋 Functional Requirements
- **Spawning**: Functions to spawn processes (e.g., `rsync`, `pnpm run build`, `vite`).
- **PTY Emulation**: Processes on macOS/Linux must be spawned using `script -q /dev/null <cmd>` to fool them into thinking they are attached to a real terminal, outputting ANSI colors.
- **Process Tracking**: Every spawned process (`execa` instance) is tracked in an object map with its `PID`, `type` (dev, watch, sync), and `status`.
- **Termination**: Use `process.kill(-pid, 'SIGKILL')`. The processes must be spawned with `{ detached: true }` so they form a new process group.

## ✅ Acceptance Criteria
- A process spawned by the engine can be killed without leaving orphan node or vite processes on the host machine.
- Output captured from the processes contains truecolor ANSI codes (verifiable via console log).
- The engine correctly parses `\r` (carriage return) characters to avoid spamming the log stream (e.g., during `pnpm install` progress bars).

## 🔧 Technical Requirements
- Rely heavily on `execa`.
- Implement a log stream parser that maintains an internal buffer array of the last N lines.
- No UI React code in this module. It must be pure logic.
