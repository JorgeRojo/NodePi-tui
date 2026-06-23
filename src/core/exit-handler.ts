import { backupRestoreManager } from './backup-restore.js';
import { logger } from './logger.js';
import { dependencyOrchestrator } from './orchestrator.js';

let handlersRegistered = false;

export function resetExitHandlersStateForTest(): void {
  handlersRegistered = false;
}

/**
 * Registers listeners on process exit signals (SIGINT, SIGTERM) to ensure the target project
 * is cleanly restored to its original state and all compiler sub-processes are terminated.
 */
export function setupExitHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const handleExit = async (): Promise<void> => {
    try {
      // 1. Terminate all file watchers and compilers
      await dependencyOrchestrator.stopAll();

      // 2. Restore backed-up node_modules and configurations
      backupRestoreManager.restore();

      // 3. Close the logger
      logger.close();

      process.exit(0);
      /* v8 ignore start */
    } catch (error) {
      console.error('Error during NodePi exit cleanup:', error);
      process.exit(1);
    }
    /* v8 ignore stop */
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}
