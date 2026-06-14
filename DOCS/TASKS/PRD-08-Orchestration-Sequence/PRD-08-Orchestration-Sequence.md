# PRD: 08-Orchestration-Sequence

## Overview

This is the heart of NodePi. It implements the execution pipeline triggered when the user presses `[r]` (Run). It orchestrates blocking and parallel phases in a strict lifecycle.

## 🎯 Objectives

- Implement the Sequential Pipeline (Clean -> Pre-Build -> Install -> Topo-Build -> Inject).
- Implement the Parallel Pipeline (Watchers, Dev Server).
- Implement Vite config wrapper injection dynamically.

## 📋 Functional Requirements

- **Smart Cache**: Read `.nodepi-cache.json`. Compute hashes of local dependency files. Skip `pnpm build` if the hash hasn't changed.
- **Topological Build**: Execute the builds using the sorted array from PRD-03.
- **Vite Wrapper**: Generate a `.vite.config.nodepi.ts` file extending the target's Vite config to disable pre-bundling caches.
- **Sync Watchers**: Launch native `chokidar` watchers on source directories that trigger `rsync` when files change.
- **Force Run `[f]`**: Ignore the cache completely and rebuild/reinstall everything.

## ✅ Acceptance Criteria

- Pressing `[r]` transitions the UI into "Running" state, spawning sequential logs.
- The target's `package.json` is successfully mutated with `"injected": true`.
- Modifying a file in a synced local dependency automatically copies it over and triggers HMR in the Vite dev server.

## 🔧 Technical Requirements

- Massive coordination of asynchronous Promises.
- Updating the `ProcessManager` (PRD-04) dynamically so the Sidebar updates with active PIDs.
- Use native `crypto` for fast hashing of source directories.
