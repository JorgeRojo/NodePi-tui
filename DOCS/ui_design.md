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

The wizard starts by quietly checking system requirements (`pnpm`, `rsync`, `Vite`, `agy`). If anything is missing, the wizard aborts with a clear error.

```text
│
◇  NodePi v1.0.0
│
◇  Validating system requirements...
│  [✓] pnpm found
│  [✓] rsync found
│  [✓] Vite configuration detected
```

### Step 2: Dependency Selection

A multi-select prompt allows the user to choose which local packages to link.

```text
│
◇  Which local dependencies do you want to link?
│  [x] lib-core (v1.0.0) - ~/projects/lib-core
│  [ ] lib-ui   (v2.1.0) - ~/projects/lib-ui
│  [x] api-sdk  (v0.5.0) - ~/projects/api-sdk
│
```

### Step 3: Mode Configuration

For each selected dependency, the user selects the mode of operation.

```text
│
◇  Select mode for lib-core:
│  ● Sync (Live watching & automatic HMR)
│  ○ Inject (Static one-time copy)
```

### Step 4: Script Selection

The wizard auto-detects scripts from `package.json`. If it's unclear, it either uses `agy` (AI Fallback) or prompts the user.

```text
│
◇  Select the watch script for lib-core:
│  ● build:watch (tsc --watch)
│  ○ dev
│  ○ None
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
◇  Ready! Starting target dev server...
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
