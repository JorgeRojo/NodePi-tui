# Dev Report: Backup and Restore Engine

## Files

| Action  | File                                       |
| ------- | ------------------------------------------ |
| Created | `src/core/backupManager.ts`                |
| Created | `src/core/__tests__/backupManager.test.ts` |

## Validation

| Check                             | Result |
| --------------------------------- | ------ |
| TypeScript (`pnpm tsc --noEmit`)  | Pass   |
| Lint (`pnpm eslint .`)            | Pass   |
| Tests (`pnpm test backupManager`) | Pass   |

## Issues

No unresolved problems. Tests passed successfully with mocked `node:fs` and `node:fs/promises`.
