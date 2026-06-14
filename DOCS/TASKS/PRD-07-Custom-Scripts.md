# PRD: 07-Custom-Scripts

## Overview
This task introduces a Custom Scripts Engine. Currently, the TUI relies heavily on scripts defined in `package.json` (e.g., `build`, `dev`, `watch`). However, developers often need to execute custom arbitrary commands that aren't present in the `package.json` of the target or dependency. This PRD enables users to define, save, and execute custom terminal commands directly from the TUI.

## 🎯 Objectives
- Expand the `.nodepirc.json` schema to support a `customScripts` array or object.
- Provide a UI mechanism to create, edit, and assign these custom scripts.
- Ensure the Execution Engine (`PRD-04`) can parse and run these custom terminal lines seamlessly.

## 📋 Functional Requirements
- **Data Model**: A custom script must define:
  - `type`: The role it fulfills (e.g., `pre-build`, `dev-server`, `build`, `watch-compiler`, `clean`).
  - `name`: A human-readable identifier (e.g., "Custom Docker Build").
  - `command`: The raw terminal line to execute (e.g., `docker-compose up -d && pnpm build:custom`).
- **Persistence**: Custom scripts must be saved in the local workspace's `.nodepirc.json` so they are shared with the team.
- **Integration**: During the interactive script selection prompt (from `PRD-06`), the user should see their defined custom scripts as selectable options alongside standard `package.json` scripts.
- **Execution**: The `execa` wrapper must parse the `command` string (handling spaces and arguments correctly) and spawn it in the correct CWD.

## 🚫 Out of Scope
- Global custom scripts shared across entirely different workspaces (stored in `~/.nodepirc.json`). They should be scoped locally first.
- Complex interactive scripts that require continuous manual user `stdin` inputs during the build phase.

## ✅ Acceptance Criteria
- Custom scripts are correctly serialized and deserialized from `.nodepirc.json`.
- The UI script selector correctly displays the custom script `name` alongside an indicator that it is a custom script.
- Running the orchestration sequence with a custom script executes the exact `command` string defined.
- If a user defines a custom script for a dependency's `build` type, the topological build phase uses that custom command instead of `pnpm run <script>`.

## 🎨 UI/UX Specifications
- In the `[c]` (Config) modal or a new `[S]` (Scripts) modal, provide a way to add a custom script via `@inkjs/ui` TextInput prompts:
  1. Prompt for script Type (Select list).
  2. Prompt for Name (Text input).
  3. Prompt for Command (Text input).

## 🔧 Technical Requirements
- Update the Zustand state slice responsible for configuration to handle the new `customScripts` node.
- Ensure the process spawning logic (which usually prefixes `pnpm run`) detects when a script is custom and directly executes the raw `command` string (potentially using `execa.command()` or executing within a shell context `shell: true` if it involves piping/chaining `&&`).
