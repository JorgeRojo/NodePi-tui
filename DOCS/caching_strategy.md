# Caching Strategy: AI-Driven Script Inference

## The Problem

When using AI (`agy`) to infer the correct build scripts (`watch` / `build`) and the output directory (`outDir`) for local dependencies, making a call on every startup introduces unnecessary latency.

A naive approach would be to cache the results by simply hashing the `package.json`'s `"scripts"` block. However, an analysis of over 65 frontend repositories showed extreme diversity:

- ~50% of projects do not use TypeScript natively.
- Output directories are often dictated by external bundler configurations (`vite.config.ts`, `webpack.config.js`, `rollup.config.js`) or compiler settings (`tsconfig.json`, `.swcrc`).

If a developer changes the `outDir` in `vite.config.ts` from `dist/` to `build/` but leaves the `package.json` unchanged, the naive cache would remain valid, leading to silent failures where NodePi attempts to sync an outdated directory.

## The Solution: Advanced Smart Hashing

To guarantee 100% cache reliability without sacrificing performance, the persistence layer (`ScriptCache`) implements a comprehensive filesystem scanning and hashing algorithm.

### Cache Invalidation Logic

Instead of only looking at `package.json`, NodePi generates a deterministic `SHA-256` hash that includes the contents of all files that govern the build process.

The hash is built using:

1. **`package.json` fields**: `"scripts"`, `"main"`, `"module"`, `"exports"`.
2. **Compiler & Bundler files (Full Content)**:
   - `tsconfig*.json` (includes `tsconfig.json`, `tsconfig.build.json`, `tsconfig.base.json`, etc.)
   - `.swcrc`
   - `vite.config.*`
   - `webpack.config.*`
   - `rollup.config.*`
   - `babel.config.*`
   - `vue.config.*`

### Workflow

1. **Load Cache**: On startup, NodePi reads the global cache file located at `~/.nodepi/scripts_cache.json`.
2. **Generate Current Hash**: For each selected local dependency, the CLI scans its root directory, reads the matching configuration files, and computes the `SHA-256` hash.
3. **Compare**:
   - **Cache Hit**: If the hash matches the one stored, the cached script paths and `outDir` are used instantly.
   - **Cache Miss**: If the hash differs (or doesn't exist), NodePi triggers a background call to `agy` passing the bundled contents of these configuration files.
     - **On AI Success**: The AI returns the inferred build paths, which are saved in the cache alongside the new hash.
     - **On AI Fallback**: If the AI call fails or times out, the CLI prompts the user to select the compilation script and output directory manually. These manual selections are saved in the cache under the same hash to prevent re-prompting on subsequent starts.

This strategy ensures that NodePi responds instantly on subsequent boots while remaining completely immune to silent build configuration changes, even when operating in offline/fallback modes.
