# NodePi TUI (`nodepi`)

`nodepi` is the Terminal User Interface (TUI) version of **node-package-injector**. It is a development tool designed to simulate and synchronize local npm dependencies physically within target projects. It avoids traditional symlinks and complex monorepo structures by leveraging **pnpm**'s native `"injected": true` mechanism.

---

## 🚀 Key Features

1. **Automatic Context (CWD)**: The target project is automatically defined by the current working directory (`process.cwd()`) from which the `nodepi` command is executed.
2. **Static Startup Validation**: Upon startup, the TUI checks system tools and validates that the CWD is a Node.js + Vite project (verifying the existence of `package.json` and `vite.config.*`). **No project scripts or commands are executed in this phase**.
3. **Real-Time Dependency Resolution**: When adding a local package, the engine immediately and recursively calculates the entire chain of local intermediate dependencies, automatically updating the active configuration.
4. **Smart Script Engine**: Optimizes startup by avoiding redundant installations (`pnpm install`) and compilations (`build`) if no file changes are detected (by comparing hashes of `package.json` and source code).
5. **Vite Cache Busting**: Physically deletes the Vite pre-bundling cache (`node_modules/.vite`) on startup, forcing Vite to rebuild its cache and pick up local dependency updates instantly.
6. **Automatic Watch Compilers**: If a dependency in Synchronization mode defines a watch/dev script in its `package.json`, the TUI runs it in the background to compile TypeScript source files on the fly.
7. **Instant Clean Restoration**: Backs up `node_modules/<dep>`, `package.json`, and `pnpm-lock.yaml` of the target project on start. Upon exit, it performs a direct physical restoration, **avoiding the need to run a slow `pnpm install` command to clean up the workspace**.
8. **Process Resiliency**: Actively listens to system exit signals (`SIGINT`, `SIGTERM`, `exit`) to ensure all background watcher/compiler processes are killed and the workspace is restored.

---

## 🎨 User Interface Layout

The TUI is structured into the following panels:

*   **Header**: Fixed top bar displaying the application name and version: `NodePi v00.00.00`.
*   **Main Area (Left)**:
    *   **Target Panel**: Active target project details and selected development script.
    *   **Dependencies Panel**: Interactive dependency list (`[t]` toggle status, `[m]` toggle mode, `[x]` remove).
    *   **Console Logs Panel**: Real-time stdout/stderr streams from compilers, `rsync`, and Vite dev server, featuring mouse-scroll support.
*   **Fixed Sidebar (Right)**: Static side panel (no scroll) displaying:
    *   **Active Processes**: List of all parallel running subprocesses (dev server, rsync watches, dependency compilers) and their PIDs. If none are active, it shows "Idle".

    *   **Dependency Timeline**: Vertical, inverted timeline displaying the target project at the top, fed by dependencies from the bottom:
        ```text
        ■ mi-app (Target CWD)
        ▲
        │  v2.1.0
        ● lib-b (Sincronización)
        ▲
        │  v1.0.2
        ● lib-a (Inyección)
        ```
    *   **Container Directories**: Configured global search paths (e.g., `~/projects`).
*   **Footer**:
    *   **Status Bar (Fixed)**: Bottom bar displaying the target CWD (formatted with `~/`) and active Git branch.
    *   **Command Bar**: Quick keyboard shortcuts (`[r]` Run, `[f]` Force Run, `[s]` Stop, `[a]` Add, `[c]` Config, `[q]` Quit).

---

## 🛠️ Technology Stack

*   **Environment**: Node.js (>= 20.11.0), macOS and Linux natively (bash and zsh).
*   **Language**: TypeScript compiled to ESM.
*   **TUI Engine**: **React + Ink** (using Yoga Flexbox engine for responsive panel distribution).
*   **Package Manager**: `pnpm` exclusively.
*   **Sync Utility**: Native `rsync` processes and file integrity checking using `shasum`.

---

## 📦 Configuration

*   **Workspace Config**: Local `./.nodepirc.json` (can be committed to the target's Git repository to share configurations with other developers).
*   **Global Config**: Global `~/.nodepirc.json` (contains the base search directories located under the user's home folder `~/`).
