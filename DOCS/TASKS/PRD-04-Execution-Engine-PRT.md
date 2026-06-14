# PRT: 04-Execution-Engine

## Overview

This task implements the Execution Engine for NodePi-tui, establishing a robust core process spawner that uses `execa` with PTY emulation to preserve truecolor ANSI outputs. It tracks all spawned processes via a Zustand vanilla store and ensures zero orphan processes using detached process groups and `-pid` termination.

## 🔍 Codebase Analysis

- **Framework & State**: The project uses `execa` for process management and `zustand` for state. Given the rule "No UI React code in this module," the state should use `zustand/vanilla` to allow direct access from core logic while remaining compatible with React later.
- **TypeScript**: Strict NodeNext ESM module resolution is active. All relative imports must end with `.js`. No `any` is allowed.
- **Separation of Concerns**: Core execution logic must reside under `src/core/`, isolating it from UI components.

## 📁 Scope of Changes

- ✨ `src/core/execution/types.ts`
- ✨ `src/core/execution/LogParser.ts`
- ✨ `src/store/processStore.ts`
- ✨ `src/core/execution/ProcessManager.ts`

## 📋 Implementation Steps

### Step 1: Define Execution Types

**File**: `src/core/execution/types.ts` **What to do**:

- Define the `ProcessType` union (`'dev' | 'watch' | 'sync'`).
- Define the `ProcessStatus` union (`'running' | 'stopped' | 'error'`).
- Define the `ProcessData` interface containing `pid: number`, `type: ProcessType`, `status: ProcessStatus`, `command: string`, and `logs: string[]` (the bounded buffer).

### Step 2: Implement the Log Stream Parser

**File**: `src/core/execution/LogParser.ts` **What to do**:

- Create a pure logic module/class `LogParser` that takes a process stream.
- Handle `\r` (carriage return) parsing: if a chunk contains `\r` without `\n`, it should overwrite the current last line in the state rather than appending a new line. This prevents tools like `pnpm install` from spamming the log buffer.
- Provide a mechanism (callback/event) to push parsed line updates back to the caller/store.

### Step 3: Implement Vanilla Zustand Process Store

**File**: `src/store/processStore.ts` **What to do**:

- Import `createStore` from `zustand/vanilla`.
- Define the state: a record/map of tracked processes keyed by their PID.
- Define actions: `addProcess(processData)`, `updateProcessStatus(pid, status)`, `removeProcess(pid)`, and `appendLog(pid, logLine, overwriteLastLine)`.
- Export the `processStore` explicitly for consumption by the Execution Engine.

### Step 4: Implement ProcessManager Singleton

**File**: `src/core/execution/ProcessManager.ts` **What to do**:

- Create a `ProcessManager` object or class that orchestrates `execa` and writes to `processStore`.
- **Spawning**: Implement `spawnProcess(cmd, args, type)`.
  - Use PTY emulation: wrap the command in `script -q /dev/null [cmd] [args]` to force native ANSI color output.
  - Pass `{ detached: true }` to `execa` to spawn the process in its own process group.
  - Dispatch the new process to `processStore`.
  - Pipe the standard outputs into `LogParser`.
- **Termination**: Implement `killProcess(pid)`.
  - Send `process.kill(-pid, 'SIGKILL')` to terminate the entire process group cleanly.
  - Handle exceptions if the PID no longer exists, and update the store status to `stopped`.
- Ensure all internal imports strictly use the `.js` extension (e.g., `import { processStore } from '../../store/processStore.js'`).

## 🔗 Step Dependencies

Step 1 (Types) must be completed first. Then Step 3 (Store) and Step 2 (Parser) can be done in parallel. Step 4 (Manager) glues them all together.

## ✅ Validation Checklist

- [ ] Process status accurately reflects `running`, `stopped`, or `error` in the Zustand store.
- [ ] `killProcess(pid)` completely eliminates the spawned process and all sub-processes (zero orphans).
- [ ] Spawning processes output valid truecolor ANSI codes.
- [ ] Progress bars using `\r` correctly overwrite the last line in the log buffer rather than producing hundreds of new lines.
- [ ] Code adheres strictly to ESM imports with `.js` extensions and lacks any UI/React imports in `src/core/`.
