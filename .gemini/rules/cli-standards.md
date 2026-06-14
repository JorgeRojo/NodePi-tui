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
