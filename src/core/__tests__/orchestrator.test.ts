import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import chokidar from 'chokidar';
import { execa } from 'execa';

import { runRsync } from '../execution.js';
import { DependencyOrchestrator } from '../orchestrator.js';

let compilerCatchCallback: ((err: any) => void) | undefined;
let stderrDataCallback: ((chunk: any) => void) | undefined;
let stdoutDataCallback: ((chunk: any) => void) | undefined;

vi.mock('execa', () => ({
  execa: vi.fn(() => {
    const mockChild = {
      pid: 12345,
      kill: vi.fn(),
      stdout: {
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            stdoutDataCallback = cb;
          }
        }),
      },
      stderr: {
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            stderrDataCallback = cb;
          }
        }),
      },
      catch: vi.fn(cb => {
        compilerCatchCallback = cb;
        return mockChild;
      }),
    };
    return mockChild as any;
  }),
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

    // Verify stderr logging and catch block
    expect(stderrDataCallback).toBeDefined();
    expect(stdoutDataCallback).toBeDefined();
    expect(compilerCatchCallback).toBeDefined();

    // Trigger stdout output
    stdoutDataCallback!(
      Buffer.from('some compile status\n  another status line\n')
    );
    // Trigger stderr output
    stderrDataCallback!(Buffer.from('some error occurred\n  another line\n'));
    // Trigger catch callback
    compilerCatchCallback!(new Error('exit crash'));

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

    // Verify chokidar ignore rules
    const ignoredFn = vi.mocked(chokidar.watch).mock.calls[0][1]!.ignored as (
      p: string
    ) => boolean;
    expect(ignoredFn('node_modules/my-lib')).toBe(true);
    expect(ignoredFn('.git/config')).toBe(true);
    expect(ignoredFn('.nodepi/temp')).toBe(true);
    expect(ignoredFn('dist/index.js')).toBe(false);

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

  test('should handle stopping compiler processes without pid', async () => {
    const mockChildNoPid = {
      kill: vi.fn(),
    };
    (orchestrator as any).compilers.set('no-pid-dep', mockChildNoPid);

    await expect(orchestrator.stopAll()).resolves.not.toThrow();
    expect(mockChildNoPid.kill).toHaveBeenCalled();
  });

  test('should handle compiler process termination errors and fallback direct kill failure gracefully', async () => {
    const mockChildThrow = {
      pid: 99999, // Non-existent PID to force process.kill throw
      kill: vi.fn().mockImplementation(() => {
        throw new Error('direct kill failed');
      }),
    };
    (orchestrator as any).compilers.set('throw-dep', mockChildThrow);

    await expect(orchestrator.stopAll()).resolves.not.toThrow();
    expect(mockChildThrow.kill).toHaveBeenCalled();
  });

  test('should handle runRsync errors inside queue gracefully', async () => {
    let watchCallback: ((event: string, path: string) => void) | undefined;
    mockWatcher.on.mockImplementation((event: string, cb: any) => {
      if (event === 'all') watchCallback = cb;
      return mockWatcher;
    });

    vi.mocked(runRsync).mockRejectedValue(new Error('rsync failed'));

    await orchestrator.startWatching('my-dep', '/src/path/dist', '/dest/path');

    watchCallback!('change', '/src/path/dist/1.js');
    await vi.advanceTimersByTimeAsync(150);

    // Should not throw, should handle error internally
    expect(runRsync).toHaveBeenCalled();
  });

  test('should fallback to Promise.resolve if enqueueSync is called for a dependency without a queue', async () => {
    // Call private enqueueSync directly
    (orchestrator as any).enqueueSync(
      'non-existent-queue-dep',
      '/src/path',
      '/dest/path'
    );

    // Advance timers so debouncing/microtasks run
    await vi.runAllTimersAsync();

    expect(runRsync).toHaveBeenCalledWith('/src/path', '/dest/path');
  });

  test('should handle errors when closing chokidar watchers during stopAll', async () => {
    const badWatcher = {
      close: vi.fn().mockRejectedValue(new Error('failed to close watcher')),
    };
    (orchestrator as any).watchers.set('bad-watcher-dep', badWatcher);

    await expect(orchestrator.stopAll()).resolves.not.toThrow();
    expect(badWatcher.close).toHaveBeenCalled();
  });
});
