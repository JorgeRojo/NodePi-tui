# UI/UX Presentation Specifications: NodePi CLI Wizard

To deliver a premium, modern developer experience in the terminal, NodePi utilizes a Step-by-Step CLI Wizard powered by **@clack/prompts**. This approach removes the complexity of rendering a responsive grid layout while maintaining an elegant, focused user flow.

---

## 1. Visual Aesthetics

- **Clean Typography**: Uses standard terminal fonts but leverages bolding and dimming to create visual hierarchy.
- **Color Palette**:
  - **Success/Completion**: Green
  - **Focus/Action**: Cyan/Blue
  - **Error/Abort**: Red
  - **Warnings/Metadata**: Yellow/Gray

## 2. Interactive Step-by-Step Flow

### Step 1: Preflight & Startup

The wizard starts by checking system requirements and configurations.

**Case A: Post-Crash Recovery Prompt** If NodePi detects left-over backup metadata (indicating an unclean exit):

```text
│
◇  NodePi v1.0.0
│
⚠️  NodePi detected an unclean shutdown from a previous execution.
│  Would you like to restore the target project backups now?
│  ● Yes, restore files to original state
│  ○ No, ignore and proceed
```

**Case B: Normal Startup**

```text
│
◇  NodePi v1.0.0
│
◇  Validating system requirements...
│  [✓] rsync found
│  [✓] git found
│  [✓] agy found (AI inference enabled)
│  [✓] Vite configuration detected (Vite integration enabled)
```

_(If Vite is missing: `│  [!] Vite configuration NOT detected (Vite HMR wrapper will be skipped)`)_ _(If agy is missing: `│  [!] agy NOT found (manual interactive fallback will be used)`)_

### Step 2: Dependency Selection & Auto-Discovery

A multi-select prompt allows the user to choose which local packages to link. If a transitive package is selected, the CLI automatically finds and includes intermediate local packages.

```text
│
◇  Which local dependencies do you want to link?
│  [x] lib-core (v1.0.0) - ~/projects/lib-core
│  [ ] lib-ui   (v2.1.0) - ~/projects/lib-ui
│
◇  Auto-discovered intermediate dependencies:
│  [✓] api-sdk added automatically because lib-core depends on it.
```

### Step 3: Git Guard & Mode Configuration

The CLI checks the Git status of all selected packages. If any are behind remote, it aborts. For non-Git folders or repositories without a remote upstream, it displays a warning and skips the check.

```text
│
◇  Validating Git status for selected packages...
│  [✓] lib-core [branch: main] - Up to date
│  [!] lib-ui   [Not a Git Repository] - Skipped Git check
│  [!] api-sdk  [No remote branch configured] - Skipped up-to-date check
│  [✗] utils    [branch: main] - ⚠️ Behind origin by 3 commits
│
🛑 Error: 'utils' is missing remote changes.
   Please run 'git pull' in ~/projects/utils before continuing.
```

### Step 4: Script Selection (AI Inference & Manual Fallback)

The CLI queries `agy` to resolve compiler commands. If the AI call succeeds, this step runs silently. If it fails or times out, the user is prompted manually:

```text
│
◇  Validating build scripts via agy...
│  [✗] agy inference timed out / failed.
│
◇  Select the watch script for lib-core:
│  ● build:watch (tsc --watch)
│  ○ dev
│  ○ None
│
◇  Enter the output build directory for lib-core:
│  ● dist
│  ○ lib
│  ○ build
│  ○ Custom path...
```

### Step 5: Execution & Orchestration

Once configuration is complete, the wizard transitions into the execution phase. A spinner indicates progress for sequential tasks.

```text
│
◇  Bootstrapping environment...
│  [✓] Backing up original package.json and node_modules
│  [✓] Injecting dependencies via pnpm
│  [✓] Generating Vite HMR wrapper
│
◇  Starting background processes...
│  ▍ [lib-core] watch compiler started
│  ▍ [lib-core] rsync watcher active
│
◇  Ready! Waiting for changes... (launch your dev server in another terminal)
```

### Step 6: Live Logs & Restoration

Once the dev server starts, standard stdout/stderr is streamed to the console. When the user presses `Ctrl+C`, the CLI catches the exit signal and restores the environment cleanly.

```text
^C
│
◇  Gracefully shutting down...
│  [✓] Stopping background watchers
│  [✓] Restoring original package.json and node_modules
│
◇  Workspace restored. Goodbye!
```
