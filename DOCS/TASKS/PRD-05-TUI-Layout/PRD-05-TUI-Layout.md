# PRD: 05-TUI-Layout

## Overview

This task bridges the logic and the user interface. It implements the Zustand state store and uses React + Ink with Yoga flexbox to draw the base dashboard.

## 🎯 Objectives

- Set up the global Zustand store slices (`useAppStore`).
- Implement terminal dimension listeners (minimum 80x24).
- Build the semantic layout components: Header, TargetPanel, DependencyList, LogsPanel, Sidebar, and Footer.

## 📋 Functional Requirements

- **Resize Listener**: Listen to `process.stdout.on('resize')`. If columns < 80 or rows < 24, hide the layout and render a bold warning.
- **Responsive Sidebar**: If columns >= 100, show the Sidebar. If < 100, hide the Sidebar to leave room for logs.
- **Logs Panel**: A scrollable view that connects to the log buffer generated in PRD-04. Must support basic vertical scroll logic if feasible, or auto-tail to the bottom.
- **Target Panel**: Displays information statically for now.
- **Footer**: Renders the quick commands legend `[r] Run, [s] Stop, [a] Add...`.

## 🚫 Out of Scope

- Actual interactivity (key presses).
- Actual starting of processes.

## ✅ Acceptance Criteria

- Running `pnpm dev` renders the complete static UI dashboard resembling the `ui_design.md` spec.
- Resizing the terminal window dynamically hides/shows the Sidebar or throws the warning banner.
- Colors are correctly applied using Ink `<Text color="green">` etc.

## 🔧 Technical Requirements

- Utilize `<Box>` components with flexbox styling (`flexDirection`, `width`, `padding`).
- No direct `console.log` anywhere in the app to avoid breaking the Ink layout. Use the Zustand logger slice.
