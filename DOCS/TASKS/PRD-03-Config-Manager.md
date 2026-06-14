# PRD: 03-Config-Manager

## Overview

The Configuration Manager acts as the single source of truth for both the workspace-specific configuration (`.nodepirc.json`) and the global settings (`~/.nodepirc.json`). It also includes the logic to discover local dependencies via globbing and sort them topologically.

## 🎯 Objectives

- Define strict TypeScript interfaces for the config shapes.
- Implement read/write utilities for these configs.
- Integrate the AI-driven script inference engine (`agy`) to resolve correct scripts automatically when adding dependencies.
- Implement a topological sorter to calculate the exact build order of dependencies.

## 📋 Functional Requirements

- **Read/Write Persistence**: The manager gracefully handles missing files by generating default templates.
- **Dependency Discovery**: Use `fast-glob` to scan configured container directories. It must extract the `name` and `version` from discovered `package.json` files.
- **AI Inference (Agy)**: When a new dependency is added, execute `agy --model gemini-1.5-flash --print ...` passing the package.json content to extract the correct `dev`, `build`, and `watch` scripts without user intervention.
- **Topological Sorting**: Parse `dependencies` and `devDependencies` of local packages. If Library A depends on Library B, the sorter must return `[Library B, Library A]` to ensure builds happen correctly.

## ✅ Acceptance Criteria

- The config manager successfully reads and writes `.nodepirc.json`.
- The dependency discovery returns a flat array of valid packages found in global container directories.
- The Agy integration successfully parses an unknown `package.json` and returns a strict JSON object mapping.
- The Topological Sorter correctly orders a deep dependency tree.

## 🔧 Technical Requirements

- Use `fs/promises` for I/O.
- Implement Agy execution via `execa` parsing `stdout`.
- Expose the resolved config to the UI through a Zustand store slice (created in PRD-05).
