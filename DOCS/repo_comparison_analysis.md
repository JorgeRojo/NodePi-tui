# Comparative Analysis: Real Repositories vs. NodePi Plan

I have performed a deep and comprehensive analysis of the **69 directories** in the `/Users/jorge/projects/frontend-repos` workspace. This report compares the actual physical characteristics of the codebase with the current plan of NodePi, identifying critical design discrepancies that we must resolve to avoid catastrophic failures when using the tool.

---

## 📊 Real Workspace Statistics

Of the 69 scanned folders, **65 are valid Node projects** (they have a readable `package.json`). The aggregated results are as follows:

### 1. Version Control and Git

- **Git Projects**: 65 out of 65 (100%).
- **Configured Upstream/Remote**: 65 out of 65 (100%).
- **Conclusion**: The proposed _Git Guard_ is fully compatible with the environment, but we must maintain safeguards for new local projects.

### 2. Package Manager

- **Yarn (`yarn.lock`)**: 65 out of 65 (100%).
- **pnpm / npm**: 0 out of 65 (0%).
- **Conclusion**: **Critical Warning**. All projects use Yarn. NodePi's injection will force the creation of `pnpm-lock.yaml` in the target project in order to resolve the physical injections. The collision warning in Preflight is essential and will always be triggered.

### 3. TypeScript and Configurations

- **Projects with `tsconfig.json`**: 32 (Approx 50%).
- **Alternative TSConfig files**:
  - The vast majority of TS connectors and libraries have **multiple tsconfig files** (e.g., `tsconfig.json` and `tsconfig.build.json` or `tsconfig.base.json`).
  - Example: `actor-networks-restapi-connector` has `tsconfig.json` (development/tests) and `tsconfig.build.json` (for production packaging).

### 4. Bundlers

- **Vite**: 7 projects (Backoffice, Dashboards, Front-common-rp10, Front-components-rp10, Front-rp10, Frontoffice, Myaccount).
- **Webpack**: 4 projects.
- **Rollup**: 2 projects.
- **Babel**: 5 projects.
- **No Explicit Bundler (pure tsc / vanilla JS)**: 51 projects (78% of the codebase).

### 5. Build Scripts

- **Have a watch script**: 56 projects (86%).
- **Have a build script**: 40 projects (61%).
- **No watch or build script**: 7 projects (connectors/libraries that use customized scripts like `dist`).

---

## 🔍 Critical Discrepancies Detected (Reality vs. Plan)

Comparing the real state of the code against the NodePi plan, **3 new architectural gaps** have emerged that the application must resolve:

### Discrepancy 1: Cache Hash ignores Auxiliary TSConfigs

> [!NOTE] **The problem**: The original caching plan scanned only `tsconfig.json`. However, almost all RedPoints connectors compile using `tsconfig.build.json` (e.g., `tsc -p ./tsconfig.build.json`).
>
> **✅ RESOLVED**: `script-cache.ts` was updated to search for any file matching `tsconfig*.json` (`f.startsWith('tsconfig') && f.endsWith('.json')`).

### Discrepancy 2: TypeScript Projects without a Watch Script

> [!IMPORTANT] **The problem**: Seven critical libraries (such as `redpoints-front-testing`, `redpoints-front-translate`, `redpoints-front-qdeveloper-rules`) completely lack a `"watch"` script in their `package.json`. However, they are TypeScript and compile via a build script named `"dist"` that runs `tsc -p ./tsconfig.build.json`.
>
> **The Solution**: If a package is TypeScript (has `tsconfig*.json` files) and the NodePi plan requires Sync but it doesn't have a `watch` script, the fallback engine must bypass the AI and automatically run the native compiler in watch mode:
>
> ```bash
> tsc -w -p ./tsconfig.build.json # (or tsconfig.json if it is the only one available)
> ```

### Discrepancy 3: Decoupled Publishing Structure (The major discrepancy)

> [!NOTE] **The problem**: 60 out of the 65 analyzed projects have `"main": ""` (empty) in their root repository `package.json`. RedPoints uses a packaging pattern where `yarn dist` compiles to `dist/`, copies the `package.json` into `dist/`, and runs `yarn pack` from within `dist/`.
>
> **✅ RESOLVED — Option A (Dynamic Modification)**: After the initial `rsync`, NodePi reads the `package.json` in `node_modules/<dep>/`. If `"main"` is empty and an `outDir` with `index.js` exists, NodePi temporarily patches that `package.json` (only the copy in `node_modules/`, never the source) to set `"main": "<outDir>/index.js"`. The patch is reversed during restoration.

---

## ⚙️ Modifications Applied to the Plan

All discrepancies have been resolved and integrated into the main documentation:

### ✅ Cache — `tsconfig*.json` glob applied

The code in `script-cache.ts` now uses `f.startsWith('tsconfig') && f.endsWith('.json')` to capture all auxiliary TSConfig files (`tsconfig.build.json`, `tsconfig.base.json`, etc.).

### ✅ TSC Watch Auto-Fallback

For TypeScript packages without a `watch` script, NodePi automatically generates `tsc -w -p ./tsconfig.build.json` (or `tsconfig.json` if it is the only one available).

### ✅ Entrypoint Patching (Option A)

After `rsync`, if `"main"` is empty in `node_modules/<dep>/package.json` and `<outDir>/index.js` exists, NodePi patches that `package.json` with `"main": "<outDir>/index.js"`. It only modifies the copy in `node_modules/`, never the source.

### ✅ PM-Agnostic Architecture

The original plan relied on `pnpm install` and `injected: true`, mechanisms that only work in pnpm workspaces. The architecture was redesigned to use **direct rsync** over the `node_modules/` folders already installed by the target project's native package manager (Yarn, npm, pnpm). See `specs.md` §1.2 and `implementation_plan.md` §1 for the new specification.
