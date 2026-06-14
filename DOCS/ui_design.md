# UI/UX Presentation & Layout Specifications: NodePi TUI

To deliver a premium, modern developer experience in the terminal, the NodePi TUI (`nodepi`) is built using **React + Ink** and styled with **Chalk**. It utilizes the **Yoga** Flexbox engine to render a responsive grid layout. 

This document defines the visual aesthetics, screen wireframes, color systems, and interactive behaviors of the TUI.

---

## 1. Visual Aesthetics & Design System

The visual design is inspired by modern terminal themes (e.g., Catppuccin Macchiato / Nord) to ensure high readability and a cohesive, state-of-the-art look.

### 1.1 Color Palette
*   **Background (Default)**: Terminals default background.
*   **Primary Accent (Focus/Selection)**: Sapphire Blue (`#8ab4f8` / Chalk `blueBright`) for selected lists, cursors, and active headers.
*   **Success (Running/Active)**: Emerald Green (`#a6e3a1` / Chalk `green`) for `[RUNNING]` processes, `[Enabled]` dependencies, and successful checks.
*   **Warning (Attention/Alert)**: Amber Yellow (`#f9e2af` / Chalk `yellow`) for warnings, pending steps, or cached operations.
*   **Danger (Error/Stopped)**: Coral Red (`#f38ba8` / Chalk `red`) for `[FAILED]` or `[STOPPED]` processes, validation errors, and exit signals.
*   **Muted (Metadata/Paths)**: Cool Gray (`#6e738d` / Chalk `gray`) for paths, PIDs, version tags, and inactive states.

### 1.2 Borders & Panels
Panels are visually separated using Unicode box-drawing characters for rounded borders (`╭ ╮ ╯ ╰ ─ │`). 
*   Active panels (possessing key focus) are rendered with **sapphire blue** borders.
*   Inactive panels are rendered with **dim gray** borders.
*   Error messages or critical alerts are rendered with **coral red** borders.

---

## 2. Layout & Wireframes

The TUI maintains a layout that adapts dynamically to the terminal window dimensions.

### 2.1 Screen 1: Startup Validation & Checks
Displayed at launch, this screen validates system requirements in a clean, animated step-by-step list.

```text
╭────────────────────────────────────────────────────────────────────────╮
│  NodePi v1.0.0 - Startup Checks                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [✓] Step 1: System Dependencies                                       │
│      - rsync (Found)                                                   │
│      - git (Found)                                                     │
│      - pnpm (Found)                                                    │
│                                                                        │
│  [✓] Step 2: Global Configuration                                      │
│      - Container directory configured: ~/projects                      │
│                                                                        │
│  [...] Step 3: Target Project Validation                               │
│      - package.json (Found)                                            │
│      - vite.config.ts (Checking...)                                    │
│                                                                        │
╰────────────────────────────────────────────────────────────────────────╯
```

*   **Error State**: If any check fails, the checking stops, the border turns red, and a corrective action box is rendered at the bottom:
    ```text
    ╭────────────────────────────────────────────────────────────────────────╮
    │  [✗] Step 1: System Dependencies                                       │
    │      - rsync (NOT FOUND)                                               │
    ├────────────────────────────────────────────────────────────────────────┤
    │  CRITICAL ERROR: rsync is required for Synchronization Mode.           │
    │                                                                        │
    │  Corrective Action:                                                    │
    │  Please install rsync via: brew install rsync                          │
    │                                                                        │
    │  [Press Q to quit]                                                     │
    ╰────────────────────────────────────────────────────────────────────────╯
    ```

---

### 2.2 Screen 2: Main Dashboard (Dual-Column Responsive Grid)
When terminal width is **>= 100 columns**, the UI renders in a side-by-side split layout:
*   **Left Column (70% width)**: Main Target Info, Dependencies List Table, and Console Logs.
*   **Right Column (30% width - Fixed)**: Active Processes and Dependency Timeline.

```text
NodePi v1.0.0
╭─ Target: mi-app [main] ─────────────────────╮╭─ Active Processes ────────────────╮
│  Version: v2.1.0                            ││  [● DEV] mi-app (PID: 43291)      │
│  Selected Dev Script: pnpm run dev          ││  [● WATCH] lib-a (PID: 43295)      │
╰─────────────────────────────────────────────╯│  [● SYNC] lib-a (PID: 43296)       │
╭─ Local Dependencies ────────────────────────╮│                                   │
│  ▶ [Enabled]  lib-a  (Sync)  v1.0.2  ~/lib-a │╰───────────────────────────────────╯
│    [Disabled] lib-b  (Build) v2.0.0  ~/lib-b │╭─ Dependency Timeline ─────────────╮
│                                             ││  ■ mi-app (Target CWD)            │
│  [a] Add Dep  [t] Toggle  [m] Mode  [x] Del ││  ▲                                 │
╰─────────────────────────────────────────────╯│  │                                 │
╭─ Console Logs ──────────────────────────────╮│  ● lib-a (Synchronization)         │
│  [lib-a] [watch] tsc --watch                ││  ▲                                 │
│  [lib-a] [watch] TypeScript compilation ok  ││  │                                 │
│  [mi-app] [dev] Vite server running on port ││  ● lib-b (Injection)               │
│                                             │╰───────────────────────────────────╯
╰─────────────────────────────────────────────╯
CWD: ~/projects/mi-app | Branch: main
[r] Run  [f] Force Run  [s] Stop  [c] Config  [q] Quit
```

#### Responsive Collapse (Width < 100 columns)
If the terminal window width falls between **80 and 99 columns**, the **Right Column** (Active Processes & Timeline) is automatically hidden. The Left Column automatically stretches to take 100% of the viewport width.

#### Window Size Warning (Dimensions < 80x24)
If the terminal size drops below **80 columns** or **24 rows** at any point (monitored via live resize listener), the dashboard is paused and the terminal renders this centered block:
```text
⚠️ Terminal too small!
Current: 75x20 | Required: >= 80x24
Please resize your terminal window to resume.
```

---

### 2.3 Screen 3: Interactive Script Selector (Modal Overlay)
When target or dependency scripts are not yet configured in `.nodepirc.json`, the dashboard is dimmed and a centered modal box appears.

```text
╭────────────────────────────────────────────────────────────────────────╮
│  Configure Scripts: lib-a (Role: Injectable Dependency)                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Select Build/Compile Script (Required):                               │
│  This script will run sequentially to compile TypeScript/JS assets.    │
│                                                                        │
│    ▶  build (tsc && vite build)                                        │
│       compile (tsc)                                                    │
│       build:dist                                                       │
│       [Skip / None]                                                    │
│                                                                        │
│  Use ↑/↓ keys to navigate, press Enter to select                       │
╰────────────────────────────────────────────────────────────────────────╯
```

Once a script is selected, it transitions smoothly to the next slot (e.g. *Watch Compiler Script*, then *Clean Script*). If all required scripts are set, the configuration is saved, the modal closes, and the dashboard resumes.

---

### 2.4 Screen 4: Add/Discover Dependency Screen
When pressing **`[a]`** (Add Dependency) from the dashboard, a fullscreen searchable fuzzy-finder interface is shown.

```text
╭────────────────────────────────────────────────────────────────────────╮
│  Add Local Dependency - Search                                         │
├────────────────────────────────────────────────────────────────────────┤
│  Search: lib_                                                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ▶  lib-a  (v1.0.2)  ~/projects/lib-a                                  │
│     lib-b  (v2.0.0)  ~/projects/lib-b                                  │
│     library-utils  (v0.1.2)  ~/projects/shared/library-utils           │
│                                                                        │
│  Showing 3 of 12 packages found in container directories.             │
│  Type to search, press Enter to select, Esc to cancel.                 │
╰────────────────────────────────────────────────────────────────────────╯
```

*   **Fuzzy Typing**: The search input line is editable. Typing updates the filtered list of local packages in real-time.
*   **Topological Chain Detection**: Selecting a dependency instantly triggers a dependency graph scan. If intermediate packages are discovered, the TUI displays a brief transition screen listing them:
    ```text
    ╭────────────────────────────────────────────────────────────────────────╮
    │  Intermediate Dependencies Detected!                                   │
    ├────────────────────────────────────────────────────────────────────────┤
    │                                                                        │
    │  Selecting "lib-b" requires the following local packages:              │
    │  - lib-a (Intermediate dependency of lib-b)                             │
    │                                                                        │
    │  [✓] These packages will be automatically added to your workspace.     │
    │                                                                        │
    │  Press Enter to confirm, Esc to abort.                                 │
    ╰────────────────────────────────────────────────────────────────────────╯
    ```

---

## 3. Keyboard & Interaction Design

A premium TUI relies on fast, fluid keyboard-driven flows. The application implements the following controls:

*   **Focus Ring**: Only one UI list is active at a time. The active panel is denoted by a bright blue border and cursor arrows (`▶`).
*   **Workspace Actions (Footer Hotkeys)**:
    *   `[r]`: Start/Run the entire environment pipeline.
    *   `[f]`: Force Run (resetting caches and rebuild/reinstall everything).
    *   `[s]`: Stop all active watch/dev server processes.
    *   `[a]`: Open the Add Dependency screen.
    *   `[c]`: Open script re-configuration modal for the focused package.
    *   `[q]`: Run exit/restore script and quit the program.
*   **Modal Interception**: Opening a modal (such as script selection or dependency addition) blocks global key listeners (e.g. `[r]` or `[q]`), capturing keyboard input exclusively. Pressing `Esc` inside a modal safely cancels the current flow and restores dashboard focus.

---

## 4. Console Logs High-Fidelity Output Rendering

To meet the requirement that the script outputs look exactly as they would when executed standalone in a normal terminal, the Console Logs Panel rendering must implement the following PTY stream mechanics:

### 4.1 Visual Output Fidelity Specs
*   **ANSI Escape Color Preservation**: All ANSI SGR codes (formatting, colors, bolding, underline) produced by compilation engines, testing frameworks, and compilers must be passed transparently. The text container will parse these codes using Chalk/custom ANSI react wrappers to display the colors exactly as intended by the tool.
*   **Carriage Return (`\r`) Handling**: Spinners, progress indicators, and dynamically updated lines use `\r` to reset the cursor back to the start of the line and overwrite the text. The TUI log buffer will detect `\r` and dynamically replace the last line in the buffer rather than appending new lines, maintaining clear, non-duplicated interactive elements.
*   **Environment-Enforced TTY Capabilities**: Spawning processes via `script -q /dev/null` forces Unix pseudo-terminal (PTY) emulation, making programs (like Vite, esbuild, and tsc) believe they are connected to a terminal. The TUI also injects `FORCE_COLOR: "1"`, `COLORTERM: "truecolor"`, and `TERM: "xterm-256color"` to ensure full color-gamut rendering.
*   **Log Buffer Limits & Scrolling**: A rolling window buffer stores up to 500 lines of log history to optimize React re-rendering performance. Vertical scrollbars are provided, allowing full navigation through previous compile histories using the mouse wheel.

