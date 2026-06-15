import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import chokidar from 'chokidar';
import { execa } from 'execa';

import { syncWatcher } from '../watcher.js';

vi.mock('chokidar', () => {
  return {
    default: {
      watch: vi.fn(),
    },
  };
});
vi.mock('execa', () => {
  return {
    execa: vi.fn(),
  };
});

describe('SyncWatcher', () => {
  let mockOn: Mock;
  let mockClose: Mock;

  beforeEach(async () => {
    await syncWatcher.closeAll();
    mockOn = vi.fn();
    mockClose = vi.fn().mockResolvedValue(undefined);

    (chokidar.watch as Mock).mockReturnValue({
      on: mockOn,
      close: mockClose,
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await syncWatcher.closeAll();
  });

  it('should initialize a watcher successfully', () => {
    syncWatcher.watch('/src', '/dest');

    expect(chokidar.watch).toHaveBeenCalledWith('/src', {
      ignored: /node_modules/,
      ignoreInitial: true,
      persistent: true,
    });
    expect(mockOn).toHaveBeenCalledWith('all', expect.any(Function));
  });

  it('should trigger rsync on file change event', async () => {
    syncWatcher.watch('/src', '/dest');

    const onCallback = mockOn.mock.calls[0][1];

    // Trigger the callback
    await onCallback('change', '/src/index.ts');

    expect(execa).toHaveBeenCalledWith('rsync', [
      '-avz',
      '--exclude',
      'node_modules',
      '/src',
      '/dest',
    ]);
  });

  it('should not initialize multiple watchers for the same source', () => {
    syncWatcher.watch('/src', '/dest');
    syncWatcher.watch('/src', '/dest2');

    expect(chokidar.watch).toHaveBeenCalledTimes(1);
  });

  it('should cleanly close all watchers', async () => {
    syncWatcher.watch('/src', '/dest');
    syncWatcher.watch('/src2', '/dest2');

    await syncWatcher.closeAll();

    expect(mockClose).toHaveBeenCalledTimes(2);
  });

  it('should skip rsync if it is already syncing the same source', async () => {
    let resolveExeca: (value: unknown) => void;
    const execaPromise = new Promise(resolve => {
      resolveExeca = resolve;
    });

    (execa as Mock).mockReturnValue(execaPromise);

    syncWatcher.watch('/src', '/dest');
    const onCallback = mockOn.mock.calls[0][1];

    // Trigger first sync (will block)
    onCallback('change', '/src/file1.ts');

    // Trigger second sync immediately
    onCallback('change', '/src/file2.ts');

    expect(execa).toHaveBeenCalledTimes(1);

    // Resolve the first execa
    resolveExeca!(undefined);

    // Wait for event loop to process the promise chain
    await new Promise(resolve => setTimeout(resolve, 0));

    // Trigger third sync after first is done
    onCallback('change', '/src/file3.ts');

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it('should handle execa failures gracefully', async () => {
    (execa as Mock).mockRejectedValue(new Error('rsync failed'));

    syncWatcher.watch('/src', '/dest');
    const onCallback = mockOn.mock.calls[0][1];

    // Should not throw
    onCallback('change', '/src/file1.ts');

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should be able to trigger again after failure
    (execa as Mock).mockResolvedValue(undefined);
    onCallback('change', '/src/file2.ts');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(execa).toHaveBeenCalledTimes(2);
  });
});
