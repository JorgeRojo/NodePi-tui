# NodePi (`nodepi`)

`nodepi` is an interactive CLI wizard for **node-package-injector**. It is a development tool designed to seamlessly simulate and synchronize local npm dependencies physically within target projects. It completely bypasses the fragility of traditional symlinks (`npm link` / `pnpm link`) and the overhead of complex monorepo structures by leveraging **pnpm** and smart file synchronization.

---

## 🚀 Key Features

1. **Interactive CLI Wizard**: A step-by-step terminal interface that guides you through selecting dependencies, choosing injection or sync modes, and starting the development environment. No complex flags or configurations required.
2. **True `node_modules` Fidelity**: Both "Inject" and "Sync" modes operate physically within the target project's real `node_modules` folder. Your IDE, linters, and bundlers see your dependencies exactly as if they were normally installed.
3. **Smart Synchronization (Sync Mode)**: Uses `chokidar` and `rsync` to instantly sync your local package changes directly into the virtual store of `node_modules`. It uses atomic replacements to safely break `pnpm`'s global hard-links without corrupting your machine's global cache.
4. **Zero-Config Vite HMR**: Automatically forces Vite to Hot-Reload changes occurring inside `node_modules`. It does this by generating a dynamic, temporary `vite.wrapper.ts` configuration, leaving your original `vite.config.ts` and `package.json` scripts completely untouched.
5. **Native pnpm Injection (Inject Mode)**: For static dependencies, it leverages `pnpm`'s native `"injected": true` mechanism for a fast, one-time physical copy.
6. **Heuristics & AI Fallback**: Uses ultra-fast static analysis on `package.json` and `tsconfig.json` to resolve build scripts and output folders. For legacy or obscure packages, it falls back to `agy` (Antigravity AI) for intelligent programmatic resolution.
7. **Clean Restoration**: Backs up your `package.json`, `pnpm-lock.yaml`, and `node_modules` on start. Upon graceful exit (Ctrl+C), it performs a pristine restoration, leaving your workspace perfectly clean.

---

## 🏗️ Architecture & Workflows

### The CLI Flow

1. **Preflight**: Validates the Node.js + Vite environment and checks for system dependencies (`rsync`, `pnpm`, and optionally `agy`).
2. **Selection**: Interactive prompts ask which local packages to link (scanned from globally configured paths).
3. **Mode Configuration**: The user chooses between **Sync** (live file watching + background compilation) or **Inject** (static copy) for each package.
4. **Script Selection**: The tool automatically detects background watch scripts for dependencies and dev scripts for the target project.
5. **Execution & Orchestration**: The wizard spins up background compilers, file watchers, and the main Vite dev server securely.

### The "Sync + Vite HMR" Magic

Getting Vite to perform Hot Module Replacement on files inside `node_modules` is notoriously difficult. `nodepi` solves this elegantly:

- Watches your local dependency source folder.
- On change, `rsync` copies the package (excluding `node_modules` and `.git`) directly into the target's resolved `node_modules/.pnpm/...` path.
- The CLI automatically generates a Vite wrapper: it temporarily renames the user's `vite.config.[ext]` to `vite.config.backup.[ext]` and writes a wrapper `vite.config.[ext]` that imports their real config and injects:
  - `optimizeDeps.exclude: ['your-package']` (Stops Vite from caching it).
  - `server.watch.ignored: ['!**/node_modules/your-package/**']` (Forces Vite's watcher to look inside node_modules).
- The user runs their project dev server normally in another terminal without modifications. Upon exit, `nodepi` instantly restores the original config file.

---

## 🛠️ Technology Stack

- **Environment**: Node.js (>= 20.11.0), macOS and Linux natively.
- **Interface**: Interactive CLI prompts (e.g., Inquirer.js or Clack).
- **File Watching**: Native Node.js `chokidar` for zero-CPU polling.
- **Package Manager**: `pnpm` exclusively.
- **Sync Utility**: Native `rsync` orchestrated via `execa`.

---

## 📦 Configuration

- **Workspace Config**: Local `./.nodepirc.json` (can be committed to the target's Git repository to share configurations with other developers).
- **Global Config**: Global `~/.nodepirc.json` (contains the base search directories located under the user's home folder `~/`).

---

## 📚 Documentation

For an in-depth look at the architecture, design, and technical specifications, refer to the following documents:

- [UI & Interactive Prompts](./DOCS/ui_design.md): Detailed visual layouts and the step-by-step wizard flow.
- [Implementation Plan](./DOCS/implementation_plan.md): Architectural roadmap and phase-by-phase execution plan.
- [Technical Specifications](./DOCS/specs.md): Deep dive into orchestration, cache-busting, and background process management.
- [Technology Stack](./DOCS/tech_stack.md): Rationale behind the libraries and core tooling.
- [Caching Strategy](./DOCS/caching_strategy.md): SHA-256 caching validation of configuration files for AI inferences.
- [Repository Comparison Analysis](./DOCS/repo_comparison_analysis.md): Deep comparison report of 65 local repositories and architectural solutions to subfolder publishing layouts.
- [Agy Prompt Specification](./DOCS/agy_prompt_specification.md): Spec guidelines for creating structured prompt calls to the AI engine.
