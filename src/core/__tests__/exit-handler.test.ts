import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { backupRestoreManager } from '../backup-restore.js';
import {
  resetExitHandlersStateForTest,
  setupExitHandlers,
} from '../exit-handler.js';
import { dependencyOrchestrator } from '../orchestrator.js';

vi.mock('../orchestrator.js', () => ({
  dependencyOrchestrator: {
    stopAll: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../backup-restore.js', () => ({
  backupRestoreManager: {
    restore: vi.fn(),
  },
}));

describe('Exit Handlers', () => {
  let onSpy: any;
  let exitSpy: any;
  let listeners: Record<string, ((...args: any[]) => any)[]>;

  beforeEach(() => {
    resetExitHandlersStateForTest();
    listeners = {};
    onSpy = vi.spyOn(process, 'on').mockImplementation(((
      event: any,
      cb: any
    ) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
      return process;
    }) as any);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    onSpy.mockRestore();
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  test('should register SIGINT and SIGTERM listeners', () => {
    setupExitHandlers();

    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  test('should stop orchestrator, restore backups, and exit on SIGINT', async () => {
    setupExitHandlers();

    const sigintListeners = listeners['SIGINT'] || [];
    expect(sigintListeners.length).toBeGreaterThan(0);

    // Trigger the SIGINT listener
    await sigintListeners[0]();

    expect(dependencyOrchestrator.stopAll).toHaveBeenCalled();
    expect(backupRestoreManager.restore).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
