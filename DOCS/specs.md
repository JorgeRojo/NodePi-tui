# Specifications: NodePi CLI Wizard

NodePi is an interactive CLI development tool designed to simulate and sync local npm dependencies in other projects when using a monorepo structure is not viable.

## 1. Functional Specifications

### 1.1 Local Dependency Configuration

- Configuration is defined per project (`process.cwd()`).
- The CLI Wizard loads previous settings from `./.nodepirc.json`.
- Users interactively select dependencies from global container directories.

### 1.2 Dependency Modes (Direct Rsync Overwrite)

Both modes operate by **physically overwriting** the dependency folder inside the target's existing `node_modules` hierarchy. NodePi does **not** run any package manager (`pnpm install`, `yarn install`, etc.) in the target project. This makes NodePi fully **package-manager agnostic** — it works identically whether the target uses Yarn, npm, or pnpm.

> **Why no `pnpm install`?** The original design relied on `pnpm`'s `"injected": true` mechanism, but this only works inside pnpm workspaces. Since 100% of the analyzed real-world repositories use Yarn, running `pnpm install` would destroy the existing `node_modules` structure (Yarn uses flat hoisting; pnpm uses a virtual store with symlinks), making the target project unable to boot. Direct `rsync` avoids this entirely.

1. **Injection Mode (Static Copy)**:
   - NodePi locates the dependency folder inside `node_modules/` of the target project (the version already installed by the target's own package manager).
   - Backs up the original folder to `.nodepi/backups/`.
   - Executes the dependency's build script (if needed) in the source package.
   - Performs a one-time `rsync` of the compiled output from the local dependency source into the target's `node_modules/<dep>/` folder, overwriting the published version with the local build.
   - **For Transitive Dependencies**: Same mechanism — NodePi resolves the physical path of the transitive dependency inside `node_modules/` (which may be nested or hoisted depending on the package manager) and overwrites it.
     - _Path Resolution_: NodePi first checks `node_modules/<dep>/` (hoisted, common in Yarn/npm). If not found, it uses `require.resolve('<dep>/package.json', { paths: [targetDir] })` to locate the exact physical path regardless of the package manager's layout strategy.
   - Result: A static physical copy that replaces the published version, fully compatible with the existing `node_modules` structure.

2. **Synchronization Mode (Live Watch)**:
   - Starts with the same backup + initial rsync as Injection Mode.
   - Spawns background compilers (`tsc -w`, etc.) in the dependency source directory.
   - Uses `chokidar` to watch the dependency's compiled output directory for changes.
   - On change, uses atomic `rsync` to copy the updated files into `node_modules/<dep>/` of the target.
   - **Debouncing & Concurrency Control**: `chokidar` events are debounced by 150ms. Only one `rsync` runs per dependency at a time; if an `rsync` is currently running, new sync events are queued and executed sequentially.
   - **Vite HMR Wrapper (Conditional)**: If Vite is detected in the target project, generates a temporary wrapper config to force HMR invalidation inside `node_modules`.

### 1.3 Execution Flow (The Wizard)

1. **Preflight**:
   - **Post-Crash Recovery Check**: Scans for left-over backup metadata (`.nodepi/backup-meta.json`) from an unclean exit (e.g., system crash, `kill -9`). If backups are found, the wizard prompts the user to restore the files to their original state before proceeding.
   - **Vite Presence Check**: Checks for a Vite config file (`vite.config.*`). If not found, Vite wrapper features are flagged to be skipped.
   - Validates command tools (`rsync`, `agy`, `git`).
2. **Prompt Flow**: Asks user for configuration interactively.
3. **Multi-Dependency Chain Auto-Discovery**: If the user selects a transitive dependency (e.g., D), the CLI searches the local container directories for intermediate dependencies (e.g., C, B) that exist between the target project and D. Any found intermediate dependencies are automatically added to the wizard in Sync mode alongside D.
   - _Topological Discovery_: NodePi reads the target project's `package.json` `dependencies`/`devDependencies`, and recursively reads each installed dependency's `package.json` from `node_modules/<dep>/package.json` to build the dependency graph. This works with any package manager since it only reads already-installed files.
4. **Git Guard & Version Guard**:
   - **Version Guard**: Compares local `package.json` version against the one installed in the target. Warns on major/minor mismatches.
   - **Git Guard**: Displays the current Git branch for each selected dependency.
     - _Non-Git Safe Check_: First verifies if the dependency is inside a Git repository (`git rev-parse --is-inside-work-tree`). If not, it skips the checks with a warning.
     - _Remote Check_: If the repo exists but lacks an upstream remote branch configured, it warns the user and skips the "behind remote" check.
     - _Behind Check_: If it has a remote and is behind, the wizard **aborts with an error** to prevent syncing obsolete code (local uncommitted changes or being "ahead" of remote are allowed).
5. **Backup**: Backs up the target dependency folders inside `node_modules/` and any config files (Vite config if applicable), writing metadata to `.nodepi/backup-meta.json`.
   - _What is NOT backed up_: `package.json` and lockfiles of the target project are **not** modified or backed up, because NodePi no longer runs any package manager command in the target. The only files modified are inside `node_modules/` and the Vite config.
6. **Build & Rsync (Sequential per Dependency)**:
   - For each dependency: 1) Run the build script (if any) in the source package → 2) `rsync` the compiled output into `node_modules/<dep>/` of the target.
   - **Entrypoint Resolution (Main Patching)**: After the initial rsync, NodePi reads the `package.json` inside `node_modules/<dep>/`. If the `"main"` field is empty or points to a non-existent file, but a compiled `outDir` (e.g., `dist/`) exists and contains an `index.js`, NodePi patches the `package.json` in `node_modules/<dep>/` to set `"main": "<outDir>/index.js"`. This handles the common "publish from subfolder" pattern where libraries build to `dist/` and the root has no entrypoint. The patch is applied to the copy in `node_modules/`, never to the source.
7. **Vite Cache Busting & Wrapper**:
   - Deletes `.vite` cache (if Vite is detected).
   - **The Master Trick (Optional)**: If Vite is detected, NodePi temporarily renames the user's `vite.config.[ext]` to `vite.config.backup.[ext]` and writes its wrapper directly as `vite.config.[ext]`. The user runs their dev server normally in another terminal. (Skipped if Vite is not present, with a warning log letting the user know they must configure HMR exclusion manually on non-Vite setups if they face watch issues).
   - **Chameleon Mode**: The wrapper mimics the target's original config extension (`.ts`, `.mjs`, `.cjs`) and syntax (`import` vs `require()`) to guarantee 100% compatibility.
   - **CommonJS Support**: The wrapper dynamically injects `vite-plugin-commonjs` using an absolute path from the CLI's own dependencies. This ensures Vite HMR doesn't crash on legacy CommonJS packages without requiring the user to install extra plugins.
8. **Parallel Spawning**:
   - Dependency watch compilers for all synced packages.
   - Rsync watchers for all synced packages.
   - _Note: The target project's development server is NEVER launched by NodePi. The user must launch their dev server manually in a separate terminal._
9. **Bulletproof Teardown**: NodePi captures all exit signals (`SIGINT`, `SIGTERM`, `uncaughtException`, `exit`). Upon exit, it restores the original dependency folders from `.nodepi/backups/` using **synchronous** IO (`fs.cpSync`, `fs.rmSync`), restores the Vite config if applicable, and deletes `.nodepi/`.

### 1.4 AI-Driven Script Inference (Agy) & Advanced Caching

NodePi eliminates manual heuristics for script resolution. Once the user selects the mode (Sync or Inject), the CLI bundles the `package.json` and all relevant build configuration files (like `tsconfig*.json`, `vite.config.*`, `webpack.config.*`, etc.) of all involved dependencies and makes a background call to `agy` (Antigravity AI). `agy` returns a strict JSON output dictating the compilation script (`watch` or `build`) and the output directory (`outDir` / `dist`).

**AI Fallback Mode**: If `agy` fails to execute, times out (5 seconds limit), or returns invalid JSON, the CLI does not crash. It automatically falls back to an interactive prompt. The prompt extracts the `"scripts"` object from the dependency's `package.json` and lets the user manually select the compilation script (or choose "None"). It then prompts the user for the output directory, offering defaults like `dist`, `lib`, or `build`.

**TSC Watch Auto-Fallback**: If a package is TypeScript (has `tsconfig*.json` files) and requires Sync mode but has no explicit `watch` script, NodePi automatically generates a native watch command: `tsc -w -p ./tsconfig.build.json` (or `tsconfig.json` if no build-specific config exists). This covers the 7+ real-world libraries that only have a `dist` build script but no watch equivalent.

**Dependencies Without Compilation (Pure JS)**: If a dependency has no build toolchain (no TypeScript, no bundler, no build/watch scripts), NodePi sets `buildScript: null`, `watchScript: null`, and `outDir: "."` (project root). In Sync mode, chokidar watches the source files directly and rsyncs them without spawning any compiler.

**Advanced Caching Layer**: To prevent unnecessary AI calls, NodePi caches the results (both AI and manual selections) in `~/.nodepi/scripts_cache.json`. The cache is keyed by a SHA-256 hash generated from the combination of the `package.json` (scripts, main, module, exports) and the full contents of all discovered configuration files in the dependency root (including `tsconfig*.json`, not just `tsconfig.json`). This guarantees that any change in any build config will safely invalidate the cache.

_Hallucination Guard_: NodePi programmatically verifies that the suggested/cached script physically exists in the package's `"scripts"` block before executing it to prevent crashes.

## 2. Technical Specifications

- **Runtime**: Node.js (>= 20.11.0).
- **Language**: TypeScript (ESM).
- **CLI Interface**: `@clack/prompts` (Premium terminal wizard).
- **Command Executor**: `execa`.
- **File Watching**: `chokidar`.
- **Package Manager Agnostic**: NodePi does not invoke any package manager in the target project. It works with Yarn, npm, pnpm, or any other PM.
- **Process Group Tracking**: Subprocesses are spawned with `{ detached: true }` and killed safely on exit via `process.kill(-pid, 'SIGKILL')`.
- **Concurrency & Debounce**: Built-in 150ms debounce and sequential execution queue for watcher syncing to prevent CPU spikes and rsync race conditions.

## 3. User Interface Specifications

The TUI has been replaced with a linear, beautiful Step-by-Step CLI Wizard.

- Eliminates grid layouts, complex resize events, and multi-panel focus rings.
- Relies on sequential inputs and elegant console streaming.
- Utilizes `Ctrl+C` solely for graceful exit and workspace restoration.

For full UI mockups and visual aesthetics, refer to `ui_design.md`.
