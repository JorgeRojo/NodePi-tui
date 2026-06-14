# CLI & TUI Standards

## Purpose

Defines the universal conventions for passing arguments, flags, and interacting with the terminal in NodePi-tui.

## Argument Parsing Rules

1. **Never reinvent the wheel**: Always use the native `node:util` `parseArgs` module. Do not parse `process.argv` manually.
2. **POSIX & GNU Syntax**:
   - Support short options (e.g. `-c`, `-v`, `-h`).
   - Support descriptive long options (e.g. `--cwd`, `--version`, `--help`).
   - Define all arguments structurally in the `parseArgs` configuration object.
3. **Double Hyphen**: `parseArgs` automatically supports the `--` boundary to stop parsing options, which must be respected for positional file paths or external arguments.
4. **Data Isolation**: Never mix the logic that extracts options with the core orchestration. Parse flags early in the entrypoint (`src/index.tsx`) and handle early exits (like `--help` and `--version`) before any async task or component mount.

## Mandatory Flags

Every entrypoint that acts as an executable must support:

- `-h, --help`: Must print standard usage and gracefully exit (`process.exit(0)`).
- `-v, --version`: Must dynamically extract the version from the root `package.json` and exit.

## Interactive/TUI Behaviors

- **Graceful degradation**: Standard errors and preflight checks must print via `console.error` and exit _before_ mounting Ink, avoiding UI corruption.
- When `cwd` is supplied, change the directory natively (`process.chdir`) immediately after parsing, so that downstream modules implicitly operate on the specified target.

## Startup & Lifecycle Management

- **Startup Validation**: Before loading the TUI, execute static checks:
  1. System Dependencies: `node`, `rsync`, `git`, `pnpm` exist in PATH. Native `crypto` and `chokidar` are available.
  2. Container Directory: Global search path configured in `~/.nodepirc.json`.
  3. CWD Validation: Current directory contains `package.json` and `vite.config.*` (statically checked without executing scripts).
- **Path Formatting**: Never display absolute paths. Replace the user's home directory prefix with `~/` across the UI (Dashboard, logs, settings).
- **Instant Exit Protocol**: Trap exit signals (`SIGINT`, `SIGTERM`). Synchronously restore `package.json`, `pnpm-lock.yaml`, and `node_modules` from their backups (`.nodepi-backup`) without running `pnpm install` during exit.
