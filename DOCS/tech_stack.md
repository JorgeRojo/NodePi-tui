# Technology Stack: NodePi TUI

Based on the system requirements (`specs.md`, `implementation_plan.md`) and recommendations consulted via the **Context7** model, this is the definitive and optimized technology stack for developing NodePi-tui.

## 1. Core & Runtime

The heart of the application ensuring performance and compatibility.

- **Runtime**: Node.js (>= 20.11.0)
- **Language**: TypeScript (configured with `NodeNext` for native ESM resolution)
- **Package Manager**: `pnpm` (exclusively, leveraging its symlink-based architecture and the `injected: true` directive)
- **Dev Runner**: `tsx` (TypeScript Execute, runs TS code directly without a prior compilation step during development)

## 2. User Interface (TUI)

Since we want a premium terminal interface, we build on the React ecosystem adapted for the console.

- **TUI Renderer**: [`ink`](https://github.com/vadimdemedes/ink) (v4.4.1). Uses the Yoga Flexbox engine to distribute the interface across Header, Main Area (Target, Dependencies, Console Logs), Sidebar, and Footer.
- **Core UI Library**: `react` (v18.2.0). Enables Hooks (`useState`, `useEffect`) to control the lifecycle of background processes.
- **Pre-built Components**: [`@inkjs/ui`](https://github.com/vadimdemedes/ink-ui). Provides the advanced primitives we need:
  - `Select`: For the interactive script selectors.
  - `TextInput`: For the Add Dependency screen.
  - `Spinner` and progress bars.
- **Styling and Colors**: `chalk` (v5.3.0). Essential for rendering status colors (Green success, Red error, Blue focus) supporting `truecolor` and ANSI.

## 3. System Logic and Orchestration (Dependencies to Install)

To replace bash scripts (`node_pi_rsync_watch.sh`, etc.) and achieve greater scalability and control, we use native Node libraries:

- **Process Execution**: `execa`
  - _Why_: Much more powerful and safer than native `child_process`. Automatically handles zombie process cleanup and enables better environment variable injection (such as forcing `FORCE_COLOR=1` and using fake TTY via `script -q`).
- **File Watching**: `chokidar`
  - _Why_: Replaces the Unix `watch` command. Efficiently observes dependency source code and intercepts changes to trigger `rsync` directly from TypeScript.
- **Fuzzy Search (Package Finder)**: `fuse.js`
  - _Why_: To implement fast search when adding a dependency on the fullscreen screen ("Type to search").
- **Directory Scanning (Container Directories)**: `fast-glob`
  - _Why_: Required to recursively and ultra-fast scan all `package.json` files located within the global working directories (e.g., `~/projects`).
- **Global State Management**: `zustand`
  - _Why_: The TUI has complex state distributed across many panels (Timeline, Process List, Logs, CWD target). Zustand is lightweight and avoids prop-drilling in React without the complexity of Redux.

## 4. Testing & Quality

- **Testing Framework**: `vitest`
  - _Why_: Ultra fast, native ESM and TypeScript support, shares configuration with Vite.
- **UI Testing**: `@inkjs/testing` (provided by Ink for console rendering tests without spinning up a real terminal).

---

### Expected `package.json` Summary

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "chalk": "^5.3.0",
    "@inkjs/ui": "^2.0.0",
    "execa": "^9.0.0",
    "chokidar": "^5.0.0",
    "fast-glob": "^3.3.0",
    "fuse.js": "^7.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "tsx": "^4.7.1",
    "vitest": "^1.3.1",
    "@inkjs/testing": "^2.0.0",
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0"
  }
}
```
