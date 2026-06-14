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
- **Import Patterns**:
  - Separate `import type` from runtime `import`.
- **Code Minimalism**:
  - Write absolute minimal code.
  - Use early returns for clarity and better type inference.
- **Data Parsing**: Validations and null checks must be explicitly performed before accessing properties of parsed structures (like config files, JSON outputs, or `package.json` reads).
