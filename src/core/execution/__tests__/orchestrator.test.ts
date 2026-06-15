import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';
import fs from 'fs/promises';

import { useAppStore } from '../../../store/appStore.js';
import { backupTarget } from '../../backupManager.js';
import { isCacheValid, updateCache } from '../cache.js';
import { runPipeline } from '../orchestrator.js';
import { processManager } from '../ProcessManager.js';
import { injectViteWrapper } from '../viteWrapper.js';
import { syncWatcher } from '../watcher.js';

vi.mock('fs/promises');
vi.mock('execa');
vi.mock('../cache.js');
vi.mock('../viteWrapper.js');
vi.mock('../../backupManager.js');

vi.mock('../../../store/appStore.js', () => {
  const mockGetState = vi.fn();
  return {
    useAppStore: {
      getState: mockGetState,
    },
  };
});

vi.mock('../watcher.js', () => ({
  syncWatcher: { watch: vi.fn(), closeAll: vi.fn() },
}));

vi.mock('../ProcessManager.js', () => ({
  processManager: {
    spawnProcess: vi.fn(),
    spawnShellProcess: vi.fn(),
    killProcess: vi.fn(),
  },
}));

describe('runPipeline', () => {
  let mockSetPipelineStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetPipelineStatus = vi.fn();

    vi.mocked(useAppStore.getState).mockReturnValue({
      pipelineStatus: 'idle',
      setPipelineStatus: mockSetPipelineStatus,
      target: {
        cwd: '/mock/target',
        devScript: 'pnpm run dev',
        name: 'app',
        branch: 'main',
        version: '1',
      },
      dependencies: [
        {
          name: 'depA',
          type: 'Sync',
          path: '/mock/depA',
          enabled: true,
          version: '1',
        },
        {
          name: 'depB',
          type: 'Inject',
          path: '/mock/depB',
          enabled: true,
          version: '1',
        },
        {
          name: 'depC',
          type: 'Sync',
          path: '/mock/depC',
          enabled: false,
          version: '1',
        }, // Disabled
      ],
      activeProcesses: [],
      timeline: [],
      logs: [],
      containerDirs: [],
      customScripts: [],
      focusedDependencyIndex: 0,
      activeModal: 'none',
      setTarget: vi.fn(),
      setDependencies: vi.fn(),
      setActiveProcesses: vi.fn(),
      setTimeline: vi.fn(),
      addLog: vi.fn(),
      setFocusedDependencyIndex: vi.fn(),
      setActiveModal: vi.fn(),
      toggleDependency: vi.fn(),
      toggleDependencyMode: vi.fn(),
      removeDependency: vi.fn(),
      addCustomScript: vi.fn(),
    });

    vi.mocked(fs.readFile).mockImplementation(async filePath => {
      const pathStr = String(filePath);
      if (pathStr.includes('depA')) {
        return JSON.stringify({ name: 'depA' });
      }
      if (pathStr.includes('depB')) {
        return JSON.stringify({ name: 'depB', dependencies: { depA: '1.0' } });
      }
      return '{}';
    });

    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(isCacheValid).mockResolvedValue(false);
    vi.mocked(updateCache).mockResolvedValue(undefined);
    vi.mocked(injectViteWrapper).mockResolvedValue(undefined);
    vi.mocked(execa).mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs pipeline correctly and respects topology', async () => {
    await runPipeline();

    expect(mockSetPipelineStatus).toHaveBeenCalledWith('running');

    // Expected execa calls:
    // depA install, depA build
    // depB install, depB build
    // target install
    expect(execa).toHaveBeenCalledWith('pnpm', ['install'], {
      cwd: '/mock/depA',
    });
    expect(execa).toHaveBeenCalledWith('pnpm', ['run', 'build'], {
      cwd: '/mock/depA',
    });
    expect(execa).toHaveBeenCalledWith('pnpm', ['install'], {
      cwd: '/mock/depB',
    });
    expect(execa).toHaveBeenCalledWith('pnpm', ['run', 'build'], {
      cwd: '/mock/depB',
    });
    expect(execa).toHaveBeenCalledWith('pnpm', ['install'], {
      cwd: '/mock/target',
    });

    // Backup target
    expect(backupTarget).toHaveBeenCalledWith('/mock/target', ['depA', 'depB']);

    // Inject wrapper
    expect(injectViteWrapper).toHaveBeenCalledWith('/mock/target');

    // Watchers
    expect(syncWatcher.watch).toHaveBeenCalledWith(
      '/mock/depA',
      expect.stringContaining('depA')
    );

    // Process manager
    expect(processManager.spawnProcess).toHaveBeenCalledWith(
      'pnpm',
      ['run', 'dev'],
      'dev'
    );
  });

  it('skips build if cache is valid and not forced', async () => {
    vi.mocked(isCacheValid).mockResolvedValue(true);
    await runPipeline();

    expect(execa).not.toHaveBeenCalledWith('pnpm', ['run', 'build'], {
      cwd: '/mock/depA',
    });
  });

  it('forces build if force flag is passed even if cache is valid', async () => {
    vi.mocked(isCacheValid).mockResolvedValue(true);
    await runPipeline(true);

    expect(execa).toHaveBeenCalledWith('pnpm', ['run', 'build'], {
      cwd: '/mock/depA',
    });
  });

  it('returns early if already running', async () => {
    vi.mocked(useAppStore.getState).mockReturnValueOnce({
      pipelineStatus: 'running',
    } as any);

    await runPipeline();
    expect(mockSetPipelineStatus).not.toHaveBeenCalled();
    expect(execa).not.toHaveBeenCalled();
  });

  it('sets error status and throws if a step fails', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('Execa Error'));
    await expect(runPipeline()).rejects.toThrow('Execa Error');
    expect(mockSetPipelineStatus).toHaveBeenCalledWith('error');
  });
});
