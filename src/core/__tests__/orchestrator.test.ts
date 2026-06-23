import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import chokidar from 'chokidar';
import { execa } from 'execa';

import { runRsync } from '../execution.js';
import { DependencyOrchestrator } from '../orchestrator.js';

vi.mock('execa', () => ({
  execa: vi.fn(() => ({
    pid: 12345,
    kill: vi.fn(),
    catch: vi.fn(),
  })),
}));

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(),
  },
}));

vi.mock('../execution.js', () => ({
  runRsync: vi.fn().mockResolvedValue(undefined),
}));

describe('DependencyOrchestrator', () => {
  let orchestrator: DependencyOrchestrator;
  let mockWatcher: any;

  beforeEach(() => {
    vi.useFakeTimers();
    orchestrator = new DependencyOrchestrator();

    // Setup watcher mock
    mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any);
  });

  afterEach(async () => {
    await orchestrator.stopAll();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('should spawn background compiler and track its process', async () => {
    await orchestrator.spawnCompiler('my-dep', '/src/path', 'tsc -w');

    expect(execa).toHaveBeenCalledWith('tsc -w', {
      cwd: '/src/path',
      shell: true,
      stdio: 'pipe',
      cleanup: true,
      detached: true,
    });

    expect(orchestrator.getActiveCompilersCount()).toBe(1);

    await orchestrator.stopAll();
    expect(orchestrator.getActiveCompilersCount()).toBe(0);
  });

  test('should setup chokidar watch and trigger rsync on file change (debounced)', async () => {
    let watchCallback: ((event: string, path: string) => void) | undefined;

    // Capture the chokidar change callback
    mockWatcher.on.mockImplementation((event: string, cb: any) => {
      if (event === 'all') {
        watchCallback = cb;
      }
      return mockWatcher;
    });

    await orchestrator.startWatching(
      'my-dep',
      '/src/path/dist',
      '/dest/path/node_modules/my-dep'
    );

    expect(chokidar.watch).toHaveBeenCalledWith(
      '/src/path/dist',
      expect.objectContaining({
        ignored: expect.any(Function),
        ignoreInitial: true,
      })
    );

    expect(watchCallback).toBeDefined();

    // Trigger file change event
    watchCallback!('change', '/src/path/dist/index.js');

    // Rsync should NOT be called immediately due to 150ms debounce
    expect(runRsync).not.toHaveBeenCalled();

    // Advance timer by 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(runRsync).not.toHaveBeenCalled();

    // Advance timer by another 60ms (160ms total)
    await vi.advanceTimersByTimeAsync(60);

    expect(runRsync).toHaveBeenCalledWith(
      '/src/path/dist',
      '/dest/path/node_modules/my-dep'
    );
  });

  test('should serialize concurrent rsync events via queue', async () => {
    let watchCallback: ((event: string, path: string) => void) | undefined;
    mockWatcher.on.mockImplementation((event: string, cb: any) => {
      if (event === 'all') {
        watchCallback = cb;
      }
      return mockWatcher;
    });

    // Make runRsync take some time to complete
    let resolveRsyncPromise: (() => void) | undefined;
    vi.mocked(runRsync).mockImplementation(() => {
      return new Promise<void>(resolve => {
        resolveRsyncPromise = resolve;
      });
    });

    await orchestrator.startWatching(
      'my-dep',
      '/src/path/dist',
      '/dest/path/node_modules/my-dep'
    );

    // Trigger first change
    watchCallback!('change', '/src/path/dist/1.js');
    await vi.advanceTimersByTimeAsync(150); // Fire first sync

    expect(runRsync).toHaveBeenCalledTimes(1);
    expect(resolveRsyncPromise).toBeDefined();

    // While first is running, trigger second change
    watchCallback!('change', '/src/path/dist/2.js');
    await vi.advanceTimersByTimeAsync(150); // Try to fire second sync

    // Second sync should be queued and not executed yet
    expect(runRsync).toHaveBeenCalledTimes(1);

    // Complete the first sync
    const resolveFirst = resolveRsyncPromise!;
    resolveFirst();

    // Wait for microtasks of promise resolution chain to propagate
    await new Promise(resolve => process.nextTick(resolve));
    await new Promise(resolve => process.nextTick(resolve));
    await new Promise(resolve => process.nextTick(resolve));

    // Now the second sync should have started
    expect(runRsync).toHaveBeenCalledTimes(2);
  });
});
