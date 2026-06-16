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
   - **For Direct Dependencies**: Modifies `package.json` to include `"injected": true` and runs `pnpm install`.
   - **For Transitive Dependencies**: Performs a static, one-time `rsync` directly into the `node_modules/.pnpm/...` virtual store (because `injected: true` in the root does not affect transitive resolutions).
   - Result: A static physical copy in the correct `node_modules` hierarchy.

2. **Synchronization Mode**:
   - Also uses `"injected": true` as a base.
   - Spawns background compilers (`tsc -w` etc.) in the dependency source.
   - Uses `chokidar` and atomic `rsync` to mirror source code changes into `node_modules/.pnpm/...` instantly.
   - Wraps Vite configuration dynamically to force HMR inside `node_modules`.

### 1.3 Execution Flow (The Wizard)

1. **Preflight**: Validates tools (`pnpm`, `rsync`, `vite`, `agy`, `git`).
2. **Prompt Flow**: Asks user for configuration interactively.
3. **Multi-Dependency Chain Auto-Discovery**: If the user selects a transitive dependency (e.g., D), the CLI searches the local container directories for intermediate dependencies (e.g., C, B) that exist between the target project and D. Any found intermediate dependencies are automatically added to the wizard in Sync mode alongside D.
   - _Topological Discovery_: To achieve this, NodePi executes `pnpm list --depth Infinity --json` in the target project, extracting the full resolved path (Target -> B -> C -> D) since a basic `package.json` read only reveals level 1 dependencies.
4. **Git Guard & Version Guard**:
   - **Version Guard**: Compares local `package.json` version against the one installed in the target. Warns on major/minor mismatches.
   - **Git Guard**: Displays the current Git branch for each selected dependency. Checks if the local branch is "behind" its remote counterpart. If a dependency is missing remote changes (needs `git pull`), the wizard **aborts with an error** to prevent syncing obsolete code (local uncommitted changes or being "ahead" of remote are allowed).
5. **Clean & Backup**: Backs up `package.json` and `node_modules`.
6. **Inject & Install (Sequential Order)**: Runs `pnpm install` with injected configs.
   - _Race Condition Prevention_: To avoid `pnpm` deleting manually synced transitive dependencies from the virtual store, the execution order is strictly: 1) Modify `package.json` -> 2) Run `pnpm install` -> 3) Execute `rsync` for transitive dependencies.
7. **Vite Cache Busting & Wrapper**: Deletes `.vite` cache.
   - **The Master Trick**: Instead of struggling with script argument injection (`--config`), NodePi temporarily renames the user's `vite.config.[ext]` to `vite.config.backup.[ext]` and writes its wrapper directly as `vite.config.[ext]`. The user runs their dev server normally in another terminal without modifications.
   - **Chameleon Mode**: The wrapper mimics the target's original config extension (`.ts`, `.mjs`, `.cjs`) and syntax (`import` vs `require()`) to guarantee 100% compatibility.
   - **CommonJS Support**: The wrapper dynamically injects `vite-plugin-commonjs` using an absolute path from the CLI's own dependencies. This ensures Vite HMR doesn't crash on legacy CommonJS packages without requiring the user to install extra plugins.
8. **Parallel Spawning**:
   - Dependency watch compilers for all synced packages.
   - Rsync watchers for all synced packages.
   - _Note: The target project's development server (e.g., Vite) is NEVER launched by NodePi. The user must launch their dev server manually in a separate terminal. NodePi purely acts as a background sync/compilation engine._
9. **Bulletproof Teardown**: NodePi captures all exit signals (`SIGINT`, `SIGTERM`, `uncaughtException`, `exit`). Upon exit, it executes lightning-fast **synchronous** IO (`fs.renameSync`, `fs.symlinkSync`, `fs.writeFileSync`) to instantly restore `vite.config.ts`, `package.json`, and original `node_modules` symlinks, guaranteeing the workspace is left pristine in milliseconds without requiring a laggy `pnpm install`.

### 1.4 AI-Driven Script Inference (Agy)

NodePi completely eliminates manual heuristics for script resolution. Once the user selects the mode (Sync or Inject), the CLI bundles the `package.json` of all involved dependencies and makes a **single** background call to `agy` (Antigravity AI). `agy` is prompted to act as an expert build system analyzer and must return a strict JSON output. This JSON dictates the exact compilation script (`watch` or `build`) and the output directory (`outDir` / `dist`) for each package in the chain. _Hallucination Guard_: NodePi doesn't blindly trust the AI. It programmatically verifies that the suggested script physically exists in the package's `"scripts"` block before executing it to prevent crashes.

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
