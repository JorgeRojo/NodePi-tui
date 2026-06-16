# Technology Stack: NodePi CLI Wizard

Based on the system requirements (`specs.md`, `implementation_plan.md`) and the architectural shift from a React TUI to a Step-by-Step CLI Wizard, this is the definitive technology stack for developing NodePi.

## 1. Core & Runtime

- **Runtime**: Node.js (>= 20.11.0)
- **Language**: TypeScript (configured with `NodeNext` for native ESM resolution)
- **Package Manager**: `pnpm` (exclusively, leveraging its `"injected": true` directive)
- **Dev Runner**: `tsx` (TypeScript Execute, runs TS code directly without a prior compilation step during development)

## 2. CLI Interface & Wizard

Since we want a premium terminal experience but with a step-by-step wizard flow instead of a complex React/Ink grid layout, we rely on modern CLI prompt libraries.

- **Prompt Engine**: [`@clack/prompts`](https://github.com/natemoo-re/clack). Provides a beautiful, cohesive, and modern step-by-step wizard interface out of the box.
- **Styling and Colors**: `picocolors` or `chalk`. Essential for rendering status colors (Green success, Red error, Blue focus).
- **Progress/Status**: Clack's built-in `spinner` and `log` utilities for elegant status reporting.

## 3. System Logic and Orchestration

To handle synchronization, compilation, and sub-process management:

- **Process Execution**: `execa`
  - _Why_: Much more powerful and safer than native `child_process`. Automatically handles zombie process cleanup and enables better environment variable injection.
- **File Watching**: `chokidar`
  - _Why_: Efficiently observes dependency source code and intercepts changes to trigger `rsync` directly from TypeScript.
- **Directory Scanning (Container Directories)**: `fast-glob`
  - _Why_: Required to recursively and ultra-fast scan all `package.json` files located within the global working directories.

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
    "fast-glob": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "vitest": "^1.3.1",
    "@types/node": "^20.11.0"
  }
}
```
