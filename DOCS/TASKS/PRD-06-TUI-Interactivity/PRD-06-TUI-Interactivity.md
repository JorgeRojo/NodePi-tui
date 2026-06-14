# PRD: 06-TUI-Interactivity

## Overview

With the layout rendered, this PRD breathes life into the UI by implementing the native `useInput` hook from Ink to handle keyboard events and rendering interactive Modals for dependency discovery.

## 🎯 Objectives

- Implement global and local keyboard listeners.
- Build the "Add Dependency" auto-discovery interactive modal.
- Build the manual "Script Selector" modal (if Agy fails or user wants to override).

## 📋 Functional Requirements

- **List Navigation**: Up/Down arrows navigate the active dependency list.
- **Toggles**: Pressing `[t]` enables/disables the focused dependency. Pressing `[m]` toggles between Injection and Sync mode.
- **Add Modal**: Pressing `[a]` overlays a modal using `@inkjs/ui` `<Select>` or fuzzy search component. It displays dependencies found by PRD-03.
- **Configuration Modal**: Pressing `[c]` opens a configuration modal for the focused dependency.

## ✅ Acceptance Criteria

- Users can visually move the cursor up and down the dependency list.
- Toggling state `[t]` immediately reflects in the UI (e.g., greying out the dependency name) and updates `.nodepirc.json`.
- Adding a dependency visually updates the dashboard immediately, and triggers the topological recursive add from PRD-03.

## 🔧 Technical Requirements

- Use Ink's `useInput((input, key) => { ... })`.
- Maintain focus states in Zustand (`focusedDependencyId`, `activeModal`).
- Use `@inkjs/ui` components for the selection menus to save time on building prompt logic.
