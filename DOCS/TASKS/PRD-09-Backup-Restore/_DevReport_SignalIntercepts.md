# Dev Report: Register Signal Handlers in Entrypoint

## Files

| Action   | File            |
| -------- | --------------- |
| Modified | `src/index.tsx` |

## Validation

| Check                                                | Result                                  |
| ---------------------------------------------------- | --------------------------------------- |
| `pnpm eslint --fix src/index.tsx`                    | Passed (fixed simple-import-sort issue) |
| `pnpm tsc --noEmit`                                  | Passed                                  |
| `pnpm test src/core/__tests__/backupManager.test.ts` | Passed                                  |

## Issues

None. The process signals (`SIGINT`, `SIGTERM`, `uncaughtException`) are intercepted in `src/index.tsx` before `bootstrap()` is called. They synchronously trigger `restoreTargetSync(process.cwd())` and then exit, preventing corrupted dependency trees or rogue processes.
