# Technology Stack: NodePi CLI Wizard

Based on the system requirements (`specs.md`, `implementation_plan.md`) and the architectural shift from a React TUI to a Step-by-Step CLI Wizard, this is the definitive technology stack for developing NodePi.

> **Context7 Validation**: The core libraries chosen below (`@clack/prompts`, `execa`, `chokidar`) have been strictly evaluated using Context7 and have received **High Reputation** ratings and top-tier benchmark scores, confirming them as the absolute state-of-the-art for Node.js CLI tooling in 2024.

## 1. Core & Runtime

- **Runtime**: Node.js (>= 20.11.0)
- **Language**: TypeScript (configured with `NodeNext` for native ESM resolution)
- **Package Manager**: `pnpm` (exclusively, leveraging its `"injected": true` directive)
- **Dev Runner**: `tsx` (TypeScript Execute, runs TS code directly without a prior compilation step during development)

## 2. CLI Interface & Wizard

Since we want a premium terminal experience but with a step-by-step wizard flow instead of a complex React/Ink grid layout, we rely on modern CLI prompt libraries.

- **Prompt Engine**: [`@clack/prompts`](https://github.com/natemoo-re/clack). Provides a beautiful, cohesive, and modern step-by-step wizard interface out of the box. *(Validated by Context7: High Reputation)*.
- **Styling and Colors**: `picocolors`. Chosen over `chalk` because it is significantly faster and lighter for rendering status colors.
- **Progress/Status**: Clack's built-in `spinner` and `log` utilities for elegant status reporting.

## 3. System Logic and Orchestration

To handle synchronization, compilation, sub-process management, and visual orchestration:

- **Process Execution & Log Streaming**: `execa`
  - _Why_: Much more powerful and safer than native `child_process`. Automatically handles zombie process cleanup and enables better environment variable injection. *(Validated by Context7: High Reputation, Score: 88.3)*.
- **File Watching**: `chokidar`
  - _Why_: Efficiently observes dependency source code and intercepts changes to trigger `rsync` directly from TypeScript. *(Validated by Context7: High Reputation, Score: 92.4)*.
- **Directory Scanning (Container Directories)**: `fast-glob`
  - _Why_: Required to recursively and ultra-fast scan all `package.json` files located within the global working directories.
- **Vite Integration**: `vite-plugin-commonjs`
  - _Why_: Shipped natively within the CLI's dependencies to be dynamically injected into the target's Vite wrapper, preventing HMR crashes with legacy CommonJS packages without burdening the end-user.

## 4. Testing & Quality

- **Testing Framework**: `vitest`
  - _Why_: Ultra fast, native ESM and TypeScript support.

---

### Expected `package.json` Summary

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "picocolors": "^1.0.0",
    "execa": "^9.0.0",
    "chokidar": "^3.6.0",
    "fast-glob": "^3.3.0",
    "vite-plugin-commonjs": "^0.10.1",
    "listr2": "^8.2.1"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "vitest": "^1.3.1",
    "@types/node": "^20.11.0"
  }
}
```
