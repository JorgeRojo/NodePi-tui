# TypeScript Rules

## Purpose

Enforces strict type safety to eliminate runtime errors, specifically tailored for Node.js ESM (`NodeNext`).

## Instructions

- **ESM NodeNext Imports (CRITICAL)**:
  - Because `tsconfig.json` specifies `"moduleResolution": "NodeNext"`, **ALL relative imports MUST include the `.js` extension** (e.g., `import { helper } from './utils.js'`), even if the target file is `.ts` or `.tsx`.
- **Strict Typing**:
  - Use the types provided by the base libraries (e.g., `BoxProps` from Ink).
  - Explicitly type the returns and parameters of `execa` streams and `chokidar` event listeners.
- **Type Safety Core**:
  - NEVER use `any`. Use `unknown` with type guards if the type is truly unknown.
  - NEVER use the non-null assertion operator `!`.
  - Use optional chaining `?.` for nullable access.
- **Function Returns**: ALL functions MUST have explicit return types.
- **Naming Conventions**:
  - Private properties/methods: Prefix with underscore.
  - State mutation functions: Use verbs indicating mutation.
  - Suffixes: Provider (Context), Helper (static), Manager (state/ops/orchestration).
- **Import Patterns**:
  - Separate `import type` from runtime `import`.
  - Group type imports from the same module; NEVER mix types and values in a single line.
- **Code Minimalism**:
  - Write absolute minimal code.
  - Use early returns for clarity and better type inference.
- **Function Patterns**:
  - Functions with >2 parameters MUST use a configuration object.
  - Use `as const` for constants and extract types via `typeof`.
- **Data Parsing**: Validations and null checks must be explicitly performed before accessing properties of parsed structures (like config files, JSON outputs, or `package.json` reads).
