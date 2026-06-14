# Specifications: NodePi TUI (`nodepi`)

NodePi TUI (whose executable terminal command will simply be `nodepi`) is the terminal user interface (TUI) version of [node-package-injector](https://github.com/JR-NodePI/node-package-injector). It is a development tool designed to simulate and sync local npm dependencies in other projects when using a monorepo structure is not viable.

This document details the functional, technical, and user interface specifications for the project.

---

## 1. Functional Specifications

NodePi TUI must support the following features:

### 1.1 Local Dependency Configuration

- Local dependency configuration is defined **per project/working directory** (`process.cwd()`).
- The TUI automatically loads the dependency list associated with the current project from the local `./.nodepirc.json` file.
- **Automatic Intermediate Dependency Calculation on Selection**: When adding a new local dependency (via the `[a]` command), the TUI will **immediately and automatically** calculate the entire chain of local intermediate dependencies required by that library (recursively inspecting each package's `package.json` and matching them against the local packages registry). All required intermediate dependencies will be automatically added to the `./.nodepirc.json` file and the active dashboard dependency list, ensuring the dependency graph is complete from the moment of configuration.
- Users can interactively:
  - Add new local dependencies to the current project (using the auto-discovery menu).
  - Temporarily enable or disable individual dependencies.
  - Change the injection or synchronization mode of local dependencies.
  - Remove dependencies from the project configuration.

### 1.2 Dependency Modes (Unified Dependency Modes)

Both modes of operation are unified under the same physical installation mechanism thanks to **`pnpm`**. For all local dependencies, the `"injected": true` metadata is added to `dependenciesMeta` in the target's `package.json`. This forces `pnpm` to physically install the dependency in `node_modules/<dependency-name>` (avoiding symlinks).

Starting from this common base installation, the user configures the mode of operation:

1. **Injection Mode (Build Mode)**:
   - **Concept**: A static "snapshot" installation of the build.
   - **Operation**: Compiles the local package, packages the result, and installs it in `node_modules/<dependency-name>` via `pnpm install`. It does not spawn live synchronizers or alter target dev config; the dependency behaves exactly like an external static package.

2. **Synchronization Mode (Sync Mode)**:
   - **Concept**: Designed for active development, allowing local library files to be modified and reflected in real-time.
   - **Operation**: Uses the same installation directory (`node_modules/<dependency-name>`), but spawns continuous `watch` processes and uses `rsync` to copy modified files from the source library directly into `node_modules`. Additionally, it dynamically generates a temporary wrapper file (`.vite.config.nodepi.ts`) so Vite watches that directory in `node_modules` and bypasses pre-bundling, achieving native browser Hot Module Replacement (HMR).

### 1.3 Development & Sync Orchestration

When pressing the **Run** action, the TUI performs the following orchestration sequence:

1. **Clean**: Kills any leftover processes from previous NodePi executions.
2. **Pre-build target**: Runs pre-compilation scripts configured in the target.
3. **Dependency Installations**: Runs installation scripts (`pnpm install`) in the source folders of all enabled local dependencies if not already cached.
4. **Topological Build**: Compiles dependencies in hierarchical order (sub-dependencies are built first).
5. **Inject**: Safely and temporarily modifies the target's `package.json` to declare the dependencies with `"injected": true` in `dependenciesMeta` pointing to their local paths, and then executes `pnpm install` in the target.
6. **Vite Cache Busting**: To ensure Vite does not use obsolete pre-bundled versions of the injected dependencies, the TUI **physically deletes** Vite's cache directory in the target (`node_modules/.vite/`) before starting the development server.
7. **Vite Config Wrapper**: Dynamically generates a temporary `.vite.config.nodepi.ts` file in the target's root extending the original `vite.config.ts` to configure HMR (disabling pre-bundling cache and enabling the watcher for its path in `node_modules`).
8. **Dependency Watch Compilers (Sync Mode)**: If a dependency in Sync mode has a watch/dev script in its `package.json` (e.g., `watch`, `dev`, `build:watch`), the TUI **spawns it in the background** to automatically compile TypeScript files on change.
9. **Sync Watchers**: Spawns continuous synchronization processes (`rsync watch`) to copy modified files from the library (including its `dist` directory) directly to `node_modules/<dependency-name>`.
10. **Dev Server**: Launches the target's development server in the background using the temporary wrapper: `pnpm run dev -- --config .vite.config.nodepi.ts` (or `pnpm exec vite --config .vite.config.nodepi.ts`).

### 1.3.1 Process Execution Model: Sequential vs Parallel

To orchestrate development workflows reliably without creating UI locks or system-wide process leaks, NodePi TUI separates the orchestration flow into **Sequential (blocking)** and **Parallel (concurrent, non-blocking)** processes:

#### 1. Sequential/Synchronous (Blocking) Processes

These processes run one after another in a predefined chronological sequence. They block the TUI execution flow until they finish. If any of these processes fail (exit code !== 0), the run sequence is aborted immediately, and the TUI does not start the dev environment. These short-lived processes are **not** listed in the sidebar's "Active Processes" panel:

- **Clean Leftovers**: Terminates any dangling background processes and removes leftover configuration wrappers.
- **Target Pre-build**: Compiles the target project (e.g. `pnpm build` if configured) before injecting packages.
- **Dependency Installations**: Installs `node_modules` inside the source folders of enabled dependencies via `pnpm install` (if package.json hashes changed). Runs sequentially per dependency to avoid I/O bottlenecks.
- **Topological Build**: Compiles each enabled dependency sequentially using their build/compile scripts. Builds are ordered topologically (e.g., if library `B` depends on library `A`, then `A` builds to completion before `B` starts building).
- **Inject & Target Install**: Modifies the target's `package.json` with `"injected": true` and runs `pnpm install` in the target project. Blocks until installation finishes.
- **Vite Cache Busting**: Deletes `node_modules/.vite/` in the target project to ensure Vite rebuilds its pre-bundled dependencies cache.
- **Vite Config Wrapper**: Generates the temporary `.vite.config.nodepi.ts` wrapper file.

#### 2. Parallel/Asynchronous (Concurrent) Processes

Once all sequential pre-requisites are successfully completed, the TUI enters the active run phase. It spawns the following processes in the background. They run concurrently and remain active until the user stops them (`[s]`) or exits the TUI (`[q]`):

- **Dependency Watch Compilers (Sync Mode)**: Spawns the watch/dev compilation script (e.g., `pnpm run watch`) for each local dependency in Sync Mode. Multiple watch compilers run concurrently in parallel.
- **Sync Watchers (rsync watch)**: Spawns the native rsync sync watcher (powered by `chokidar` + `execa rsync`) for each local dependency in Sync Mode. Multiple watchers run concurrently in parallel.
- **Target Dev Server**: Launches the target project's development server using the wrapper config (e.g., `pnpm run dev -- --config .vite.config.nodepi.ts`). Runs in parallel with all watch compilers and sync watchers.

#### Sidebar Visibility & PID Tracking

All parallel processes running in the background are tracked dynamically by the TUI and listed in the fixed right sidebar under **Active Processes**:

- **Dynamic List**: Each entry displays:
  - **Status indicator**: (e.g., `[RUNNING]` in green, `[FAILED]` in red, or `[STOPPED]`).
  - **Process Type**: `Dev Server`, `Watch Compiler`, or `Sync Watcher`.
  - **Package/Target Name**: The name of the package (e.g. `mi-app`, `lib-a`).
  - **PID**: The Process ID of the process group leader.
- **Clean Group Termination**: Spawned with `{ detached: true }` in Node.js, forming unique process groups. The TUI stops them by sending a signal to their negative PID (`process.kill(-pid, 'SIGKILL')`), preventing wildcard name-based kills that could terminate unrelated processes.

### 1.4 Clean-up, Backup & Reset (Instant Restoration without Re-installation)

- **Pre-injection Backup**: Before starting injection or sync, the TUI will perform temporary physical backups of:
  1. The original physical directory of each package under `node_modules/<dependency-name>` (stored under `node_modules/.nodepi-backup/<dependency-name>`).
  2. The original `package.json` and `pnpm-lock.yaml` files of the target project.
- **Restore on Stop or Exit (Instant Exit)**: When stopping processes or exiting the TUI, the original state will be restored immediately:
  - Injected dependencies and temporary files (such as `.vite.config.nodepi.ts`) are deleted.
  - Original `package.json` and `pnpm-lock.yaml` files are restored from backup.
  - Original dependency directories in `node_modules/` are restored from `node_modules/.nodepi-backup/`.
  - _Performance Note_: Since we restore exact backups of `package.json`, `pnpm-lock.yaml`, and `node_modules` folders, **there is no need to run a slow package installation command (like `pnpm install`) upon exiting**, making TUI shutdown instant and leaving the workspace completely clean.
- **Resilience to Abrupt Exits (Exit Signals)**: The TUI actively listens to system exit signals (`SIGINT` on Ctrl+C, `SIGTERM`, `exit`, or uncaught exceptions) to run this restoration routine and terminate all background watcher and compiler processes before the terminal process ends. This guarantees the workspace never remains in a corrupted state.

### 1.5 Startup Checks & Validations

When launching the application via `nodepi`, the TUI strictly follows these three validation steps before opening the Dashboard:

1. **Step 1: System Dependencies**: Checks that `node`, `rsync`, `git`, and the package manager **`pnpm`** are available in the system PATH. File hashing is performed natively via Node.js `crypto` module (no external `shasum` binary required). File watching is handled natively via `chokidar` (no external `watch` binary required).
2. **Step 2: Container Directories**: Verifies that at least one global base search directory is configured (in `~/.nodepirc.json`) and that all of them are located inside the user's home directory (`~/`).
3. **Step 3: Target Project Validation (CWD)**: Statically checks that the current directory (`process.cwd()`) contains files characteristic of a Node + Vite project. Specifically, it verifies the physical existence of `package.json` and a Vite configuration file (such as `vite.config.ts`, `vite.config.js`, `vite.config.mjs`, or `vite.config.cjs`). **No project scripts or commands are executed during this validation phase.**

**Failure Behavior**: If any of these three steps fail, the TUI will display an error screen with corrective instructions (e.g., command to install a missing tool, request to configure a container directory, or warning that the folder is not a Vite project) and stop execution.

### 1.6 Global Settings & Path Display

The TUI provides a global configuration menu with the following rules:

- **Container Directories (Minimum 1)**: Global base directories where local libraries are located. When adding dependencies, the TUI scans these folders to discover subdirectories containing a valid `package.json`, listing them interactively.
- **Tilde Path Representation (`~/`)**: Throughout the application UI (Target, Dependencies, Settings, and Logs), **the full absolute path is never displayed**. Instead, the path prefix to the user's home directory is replaced with a tilde character (`~/`), e.g., showing `~/projects/my-library` instead of `/Users/jorge/projects/my-library`.
- **Default Branch for Intermediate Packages**: Standard git branch definition (e.g., `main`) to which the TUI will attempt to align intermediate packages via git before compiling.

### 1.7 Smart Script Engine

To maximize automation and minimize manual decisions for the user, the TUI incorporates an intelligent engine to dynamically decide when to execute each script based on the file system state, utilizing a local cache file `.nodepi-cache.json` in the target project:

1. **Standard Auto-detection**:
   - **Installation/Setup**: Runs `pnpm install` by default to resolve local dependencies.
   - **Compilation (Build)**: Detects if the local dependency contains a `build` or `compile` script in its `package.json`.
   - **Dev Server (Dev)**: Detects the main development script in the target (`dev`, `start`, or `serve`).
2. **Smart Cache & Hashing**:
   - **Smart Installation (Installs)**: Upon startup, the engine computes a hash of the package's `package.json`. The `pnpm install` execution step is skipped if and only if the package's `node_modules` folder physically exists and the `package.json` hash matches the cached value of the last successful run.
   - **Smart Compilation (Builds)**: For local dependencies, the engine computes a fast file hash of the source code (excluding `node_modules` and `.git`). Compiling the dependency is skipped if its output directory (`dist`, `lib`, or `build`) already exists and the source code hash matches the last successful build hash.
3. **Manual Override (Clean/Force Run)**:
   - The TUI shortcut **`[f]`** (Force/Clean Run) bypasses the smart decision engine. It clears cached hashes, deletes `node_modules` and `dist` directories in local dependencies, and forces a complete, sequential run of all installation and build phases from scratch.

### 1.8 Script Role Configurations & AI-Driven Script Inference (Agy)

Every project directory managed by NodePi TUI can act in one of two distinct roles:

1. **Target App (Workspace Project)**: The main application under development that consumes injected libraries.
2. **Injectable Dependency (Library Project)**: A local package/library whose build artifacts are injected and synchronized into the target's `node_modules` folder.

Since script names within `package.json` vary widely between projects (e.g., some use `build`, others `compile`, others `dev`, `watch`, or `start`), the TUI maintains an explicit script role configuration in `./.nodepirc.json`.

#### 1. AI-Driven Script Inference & Fallback Prompting

- **Trigger Condition**: When a project is selected (either the target workspace or an added dependency), if its script configurations are missing in `.nodepirc.json`, the TUI **must intercept the flow** and attempt to resolve them automatically using the **Agy** AI integration.
- **Agy Behavior**:
  - The TUI executes `agy --model gemini-1.5-flash ...` passing the `package.json` to extract the correct `dev`, `build`, and `watch` scripts without user intervention.
  - The inferred scripts are instantly saved to `./.nodepirc.json`.
- **Fallback Interactive Selector**:
  - If the Agy execution fails or the AI is unable to infer the correct scripts, the TUI gracefully falls back to an interactive modal.
  - The fallback parses the `"scripts"` object from the `package.json` file and displays a vertical selection menu for the user to pick scripts manually.
  - Users can reconfigure these scripts at any time by pressing **`[c]`** (Config) when focusing the package.

#### 2. Target App Script Configuration (Workspace Role)

These scripts orchestrate the execution and preparation of the consumer application. Only the following script types are configurable for this role:

- **Dev Server Script (Required / Parallel)**:
  - _Purpose_: Launches the development server. Spawns in the background using the custom Vite wrapper config (e.g. `pnpm run dev -- --config .vite.config.nodepi.ts`).
  - _Typical names_: `dev`, `start`, `serve`.
- **Pre-build Script (Optional / Sequential)**:
  - _Purpose_: Runs a preparation or validation step in the target workspace _before_ dependency injection and installation occurs (e.g., cleaning cache or building local config files).
  - _Typical names_: `prebuild`, `clean`, `prepare` (defaults to "None" if skipped).

_Note: Build or Watch Compiler scripts are not needed for packages in the Target role._

#### 3. Injectable Dependency Script Configuration (Dependency Role)

These scripts handle compiling, watching, and cleaning the library package. The following script types are configurable for this role:

- **Build/Compile Script (Required / Sequential)**:
  - _Purpose_: Compiles the library source code to its output directory (e.g. `dist/`). Executed once sequentially during the initial build to bootstrap the dependency snapshot.
  - _Typical names_: `build`, `compile`, `build:dist`.
- **Watch Compiler Script (Required for Sync Mode / Parallel)**:
  - _Purpose_: Runs the library's compiler in watch mode. Spawns in the background in parallel. On source code change, it automatically rebuilds the artifacts, which are then copied into the target's `node_modules` by `rsync`.
  - _Typical names_: `watch`, `dev`, `build:watch`, `dev:watch` (can be set to `[None]` if the library is only run in static Injection Mode).
- **Clean Script (Optional / Sequential)**:
  - _Purpose_: Cleans up old build output directories (e.g. `dist/`, `lib/`) in the dependency folder before starting a fresh build.
  - _Typical names_: `clean`, `clear` (defaults to "None" if skipped).

---

## 2. Technical Specifications

### 2.1 Technology Stack

- **Operating Systems**: macOS and Linux (Native UNIX environments).
- **Shells**: `bash` and `zsh`.
- **Runtime**: Node.js (>= 20.11.0).
- **Language**: TypeScript (compiled to ESM, module resolution `NodeNext`).
- **TUI Engine**: React + [Ink](https://github.com/vadimdemedes/ink) (React renderer for CLI layouts).
  - _Design Note_: Ink is chosen over low-level Go frameworks (like _Bubble Tea_ / _Lip Gloss_) to maintain consistency with the web development tech stack (TypeScript, React) and leverage its Flexbox engine (Yoga) for fluid, responsive panel distributions (Main and Sidebar).
- **TUI Components**: `@inkjs/ui` (pre-built interactive primitives: `Select`, `TextInput`, `Spinner`).
- **Styling & Colors**: `chalk` (terminal ANSI color rendering with truecolor support).
- **Command Executor**: `execa` (process spawning with automatic cleanup, environment injection, and TTY emulation support — replaces raw `child_process`).
- **File Watching**: `chokidar` (native cross-platform file system watcher — replaces Unix `watch` binary).
- **Directory Scanning**: `fast-glob` (high-performance recursive glob matching for container directory discovery).
- **Fuzzy Search**: `fuse.js` (client-side fuzzy search for the Add Dependency screen).
- **State Management**: `zustand` (lightweight global store with slice-based architecture for logs, processes, and layout state).
- **Packaging Support**: `pnpm` exclusively.
- **Testing**: `vitest` (unit/integration tests) + `@inkjs/testing` (headless TUI component rendering tests).
- **Dev Runner**: `tsx` (TypeScript Execute, runs `.ts`/`.tsx` files directly without a build step during development).

### 2.2 Configuration Storage

Configuration settings (including dependency lists and active configurations) will be saved in JSON format:

- **Workspace Config**: `.nodepirc.json` in the directory where the TUI is run. This allows sharing the workspace dependency configuration with other developers via Git.
- **Global Config**: `~/.nodepirc.json` in the user's home directory as a fallback.

### 2.3 Dependency Injection Scripting

The TUI replaces all legacy shell scripts from the original Electron project with native Node.js/TypeScript implementations. No external `.sh` scripts are shipped or executed:

- **Native Sync Watcher**: The original `node_pi_rsync_watch.sh` is replaced by a native `chokidar` file watcher that detects source changes and triggers `rsync` via `execa`. This provides better error handling, cross-platform consistency, and tighter integration with the TUI's process lifecycle.
- **Native Process Group Tracking (NodePi-2 Strategy)**: Instead of using a wildcard process-killing bash script (such as the original `node_pi_reset_kill_all.sh` which often terminated unrelated node or vite processes on the system), the TUI implements native process tracking in Node.js. Every spawned subprocess (compilers, watchers, dev server) is started with `{ detached: true }` to form a new process group. Upon stopping or exiting, the TUI sends a targeted signal `process.kill(-pid, 'SIGKILL')` to terminate that specific process group, keeping all other unrelated terminal/system processes completely safe.
- **Native pnpm Injection**: The TUI internally modifies the target's `package.json` to declare dependencies via `file:../local-path` protocol and the `"injected": true` field under `dependenciesMeta`, running `pnpm install` directly via `execa`.
- **Native Config Wrapper**: The TUI internally implements the creation and removal of the Vite wrapper (`.vite.config.nodepi.ts`) using native file system operations, replacing the legacy external shell scripts (`node_pi_sync_vite.sh` / `node_pi_sync_craco.sh`).

### 2.4 TTY/PTY Emulation & Console Output Fidelity

To guarantee that outputs from subprocesses (such as the Vite development server, `tsc` compilation errors, or `pnpm` warnings) are rendered in the Console Logs Panel exactly as they would look in a standalone terminal execution, the TUI implements PTY emulation and high-fidelity output parsing:

1. **Pseudo-Terminal (PTY) Simulation**:
   - When spawning background processes (watch compilers, dev servers, sync processes) using Node's `child_process.spawn`, the TUI does not connect stdout/stderr directly to standard pipes, which would cause the child processes to disable color output.
   - Instead, on macOS and Linux, the command is wrapped and executed inside a native pseudo-terminal allocator using the Unix `script -q /dev/null` utility.
   - Example wrapper command structure:
     `script -q /dev/null <command-with-args>`
   - This forces the spawned tool to detect a PTY connection, preserving interactive features, formatted spinners, and layout structures.

2. **Forced Color Environment**:
   - The TUI injects specific environment variables into all spawned subprocesses to enforce colored output:
     - `FORCE_COLOR: "1"`
     - `COLORTERM: "truecolor"`
     - `TERM: "xterm-256color"`

3. **Carriage Return (`\r`) & Backspace Interpretation**:
   - Modern CLI tools make heavy use of carriage returns (`\r`) to clear and update lines in-place (e.g. download progress bars, active compilation spinners).
   - Rather than treating `\r` as a newline separator (which would cause the log viewer to print thousands of duplicate progress lines), the TUI's stream parser processes carriage returns by overwriting the current active line in the logs buffer.

4. **ANSI Escape Code Rendering**:
   - The Console Logs Panel preserves all ANSI escape codes and colors. Ink parses and displays these styles natively using Chalk, ensuring warning text is printed in yellow, errors in red, and paths or tags in their respective colors.

---

## 3. User Interface Specifications

The TUI runs directly in the context of the current working directory (`process.cwd()`), which is assumed to be the **Target Project** where we want to inject/sync libraries. Consequently, **no project selector is required**. The TUI launches directly into the Dashboard screen:

### 3.1 Dashboard Screen (Main Screen)

The TUI is distributed in a structured layout as follows:

- **Header**: Fixed at the top, showing the application name and version (e.g., **`NodePi v1.0.0`**), retrieved from the binary's package.json.
- **Main Area (Left)**:
  - **Target Panel**: Displays information of the current target project: package name, version, and the selected development script.
  - **Dependencies Panel**: List of local dependencies configured for this project (loaded from `./.nodepirc.json`).
    - **Cursor Navigation**: The user moves vertically with the arrow keys (Up/Down) to focus dependencies.
    - **Quick Actions on focused dependency**:
      - `[t]`: Toggle status (_Enabled_ / _Disabled_).
      - `[m]`: Toggle operation mode (_Injection_ / _Synchronization_).
      - `[x]`: Delete dependency from the list.
  - **Console Logs Panel**: Real-time log viewer for subprocesses (library compilation, rsync, and Vite dev server output). This section of the screen (logs area) features mouse-scroll support.
- **Sidebar (Right)**: Fixed right-hand panel showing contextual information (no scroll):
  - **Active Processes**: A detailed list of all terminal subprocesses running in parallel in the background (e.g., the Vite dev server, `rsync watch` loops for each library, and dependency watch compilers). It will show the process type, package name, and its associated PID. If no processes are running, it will display "Idle".
  - **Dependency Timeline (Build & Sync Timeline)**: Visual vertical timeline showing the local dependency chain sorted in reverse order, where the target project (CWD) sits at the top and dependencies feed upwards with directional arrows (`▲` and `│`).
    - Visual example in the terminal:
      ```text
       ■ mi-app (Target CWD)
       ▲
       │  v2.0.0
       ● lib-b (Inject)
       ▲
       │  v1.0.2
       ● lib-a (Sync)
      ```
  - **Container Directories**: Configured global base search paths (e.g., `~/projects`).
- **Footer (Status Bar & Command Bar)**:
  - **Status Bar (Fixed)**: Bottom bar always visible showing the current working directory (`process.cwd()`, formatted with a tilde `~/`) and the active Git branch of the target project.
  - **Command Bar**: System keyboard shortcuts (`[r]` Run, `[f]` Force Run, `[s]` Stop, `[a]` Add Dep, `[c]` Config, `[q]` Quit).

### 3.2 Terminal Dimensions & Adaptability (Inspired by OpenCode)

To ensure optimal rendering in any development environment (such as integrated VS Code terminals or multiplexers like `tmux`), the NodePi TUI implements the following adaptability rules:

1. **Minimum Dimensions**: The terminal window must have a minimum size of **80 columns by 24 rows**. If dimensions are smaller upon startup or during live resizing, the TUI will temporarily suspend the dashboard and render a clean warning: _"Please enlarge your terminal window (Minimum 80x24)"_.
2. **Responsive Layout**:
   - **Wide Terminals (>= 100 columns)**: Renders the two-column side-by-side view (Main Area on the left and Fixed Sidebar on the right).
   - **Narrow Terminals (80 to 99 columns)**: The Sidebar is automatically hidden to prioritize space for the Console Logs and the Dependencies list in the Main Area.
3. **Visual Aesthetics**: Uses a clean color palette (similar to Catppuccin/Nord) based on greys, blue accents for focus, green for enabled dependencies, red/orange for errors/warnings, and discrete dark backgrounds, ensuring premium terminal aesthetics and readability.

### 3.3 Detailed UI/UX Layout Specifications

For a complete visual breakdown of all screens (Startup, Dashboard, Script Selection, and Dependency Discovery), color schemas, responsive grid columns, and keyboard/focus interaction rings, see [ui_design.md](file:///Users/jorge/projects/NodePi-tui/DOCS/ui_design.md).
