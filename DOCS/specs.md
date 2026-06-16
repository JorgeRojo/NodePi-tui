# Specifications: NodePi CLI Wizard

NodePi is an interactive CLI development tool designed to simulate and sync local npm dependencies in other projects when using a monorepo structure is not viable.

## 1. Functional Specifications

### 1.1 Local Dependency Configuration

- Configuration is defined per project (`process.cwd()`).
- The CLI Wizard loads previous settings from `./.nodepirc.json`.
- Users interactively select dependencies from global container directories.

### 1.2 Dependency Modes (Unified in `node_modules`)

Both modes install the dependency directly into the real `node_modules` of the target project, ensuring complete compatibility with IDEs and tooling.

1. **Injection Mode**:
   - Modifies `package.json` to include `"injected": true`.
   - Runs `pnpm install`.
   - Result: A static physical copy in `node_modules`.

2. **Synchronization Mode**:
   - Also uses `"injected": true` as a base.
   - Spawns background compilers (`tsc -w` etc.) in the dependency source.
   - Uses `chokidar` and atomic `rsync` to mirror source code changes into `node_modules/.pnpm/...` instantly.
   - Wraps Vite configuration dynamically to force HMR inside `node_modules`.

### 1.3 Execution Flow (The Wizard)

1. **Preflight**: Validates tools (`pnpm`, `rsync`, `vite`, `agy`).
2. **Prompt Flow**: Asks user for configuration interactively.
3. **Clean & Backup**: Backs up `package.json` and `node_modules`.
4. **Inject & Install**: Runs `pnpm install` with injected configs.
5. **Vite Cache Busting & Wrapper**: Deletes `.vite` cache and generates `.nodepi/vite.wrapper.ts`.
6. **Parallel Spawning**:
   - Dependency watch compilers.
   - Rsync watchers.
   - Target project dev server (`pnpm run dev -- --config .nodepi/vite.wrapper.ts`).

### 1.4 AI-Driven Script Inference (Agy)

When script configurations are missing and static heuristics fail, the CLI intercepts the flow and uses the **Agy** AI integration (`agy`) via a background subprocess to parse the `package.json` and extract the correct `dev` or `build` scripts.

## 2. Technical Specifications

- **Runtime**: Node.js (>= 20.11.0).
- **Language**: TypeScript (ESM).
- **CLI Interface**: `@clack/prompts` (Premium terminal wizard).
- **Command Executor**: `execa`.
- **File Watching**: `chokidar`.
- **Packaging**: `pnpm` exclusively.
- **Process Group Tracking**: Subprocesses are spawned with `{ detached: true }` and killed safely on exit via `process.kill(-pid, 'SIGKILL')`.

## 3. User Interface Specifications

The TUI has been replaced with a linear, beautiful Step-by-Step CLI Wizard.

- Eliminates grid layouts, complex resize events, and multi-panel focus rings.
- Relies on sequential inputs and elegant console streaming.
- Utilizes `Ctrl+C` solely for graceful exit and workspace restoration.

For full UI mockups and visual aesthetics, refer to `ui_design.md`.
