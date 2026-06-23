import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { confirm, multiselect, select } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs/promises';

import { resolveBuildAndWatch } from '../core/ai-engine.js';
import { backupRestoreManager } from '../core/backup-restore.js';
import { configManager } from '../core/config.js';
import {
  buildDependencyGraph,
  findIntermediateDependencies,
  scanContainers,
} from '../core/discovery.js';
import { patchEntrypoint, runRsync } from '../core/execution.js';
import { setupExitHandlers } from '../core/exit-handler.js';
import { getGitStatus, getVersionMismatch } from '../core/git-guard.js';
import { dependencyOrchestrator } from '../core/orchestrator.js';
import { runPreflight } from '../core/preflight.js';
import { validateProject } from '../core/project-validator.js';
import { runWizard } from '../wizard.js';

vi.mock('../core/preflight.js', () => ({
  runPreflight: vi.fn(),
}));

vi.mock('../core/project-validator.js', () => ({
  validateProject: vi.fn(),
}));

vi.mock('../core/config.js', () => ({
  configManager: {
    load: vi.fn(),
    loadGlobal: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('../core/discovery.js', () => ({
  scanContainers: vi.fn(),
  buildDependencyGraph: vi.fn(),
  findIntermediateDependencies: vi.fn(),
}));

vi.mock('../core/git-guard.js', () => ({
  getGitStatus: vi.fn(),
  getVersionMismatch: vi.fn(),
}));

vi.mock('../core/ai-engine.js', () => ({
  resolveBuildAndWatch: vi.fn(),
}));

vi.mock('../core/backup-restore.js', () => ({
  backupRestoreManager: {
    backup: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock('../core/execution.js', () => ({
  runRsync: vi.fn(),
  patchEntrypoint: vi.fn(),
  writeViteWrapper: vi.fn(),
}));

vi.mock('../core/orchestrator.js', () => ({
  dependencyOrchestrator: {
    spawnCompiler: vi.fn(),
    startWatching: vi.fn(),
    stopAll: vi.fn(),
  },
}));

vi.mock('../core/exit-handler.js', () => ({
  setupExitHandlers: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
}));

describe('CLI Wizard Orchestrator (runWizard)', () => {
  let exitSpy: any;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    // Default Preflight passes
    vi.mocked(runPreflight).mockResolvedValue({
      isViteProject: false,
      viteConfigPath: null,
      hasAgy: true,
    });

    // Default Project Validation passes
    vi.mocked(validateProject).mockResolvedValue({
      isValid: true,
      packageManager: 'npm',
      projectType: 'standard-vite',
      scriptSequence: [
        { command: 'npm install', description: 'Instala las dependencias del proyecto.' },
      ],
      warnings: [],
    });

    // Default Configs
    vi.mocked(configManager.loadGlobal).mockResolvedValue({
      containers: ['/my/projects'],
    });
    vi.mocked(configManager.load).mockResolvedValue({
      mode: 'inject',
      dependencies: [],
    });

    // Local packages scan finds 'lib-core'
    const mockLocalPkgs = new Map<string, string>([
      ['lib-core', '/my/projects/lib-core'],
    ]);
    vi.mocked(scanContainers).mockResolvedValue(mockLocalPkgs);

    // Dependency graph: Target depends on 'lib-core'
    const mockGraph = new Map<string, string[]>([
      ['target', ['lib-core']],
      ['lib-core', []],
    ]);
    vi.mocked(buildDependencyGraph).mockResolvedValue(mockGraph);
    vi.mocked(findIntermediateDependencies).mockReturnValue([]);

    // Git Status is clean, versions match
    vi.mocked(getGitStatus).mockResolvedValue({
      isGit: true,
      branch: 'main',
      hasUpstream: true,
      isBehind: false,
    });
    vi.mocked(getVersionMismatch).mockResolvedValue({
      localVersion: '1.0.0',
      targetVersion: '1.0.0',
      hasMismatch: false,
      type: null,
    });

    // AI/Heuristics resolutions
    vi.mocked(resolveBuildAndWatch).mockResolvedValue({
      buildScript: 'build',
      watchScript: 'watch',
      outDir: 'dist',
    });

    // Default prompt mock selections
    vi.mocked(multiselect).mockResolvedValue(['lib-core']);
    vi.mocked(select).mockResolvedValue('inject'); // opera mode select
    vi.mocked(confirm).mockResolvedValue(false);

    // Mock fs.readFile for local packages package.json
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: any) => {
      if (filePath.endsWith('package.json')) {
        return JSON.stringify({
          name: 'lib-core',
          version: '1.0.0',
          scripts: { build: 'tsc', watch: 'tsc -w' },
        });
      }
      throw new Error('ENOENT');
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  test('should run Inject Mode flow successfully', async () => {
    await runWizard();

    // Verify Preflight was called
    expect(runPreflight).toHaveBeenCalled();

    // Verify it scanned global containers
    expect(scanContainers).toHaveBeenCalledWith(['/my/projects']);

    // Verify it checked Git and version mismatch
    expect(getGitStatus).toHaveBeenCalledWith('/my/projects/lib-core');
    expect(getVersionMismatch).toHaveBeenCalledWith(
      '/my/projects/lib-core',
      expect.stringContaining('node_modules/lib-core')
    );

    // Verify script resolution
    expect(resolveBuildAndWatch).toHaveBeenCalledWith(
      '/my/projects/lib-core',
      expect.any(Object),
      true,
      expect.any(Function)
    );

    // Verify initial build script execution
    expect(execa).toHaveBeenCalledWith(
      'npm',
      ['run', 'build'],
      expect.objectContaining({ cwd: '/my/projects/lib-core' })
    );

    // Verify backup, rsync, and entrypoint patching
    expect(backupRestoreManager.backup).toHaveBeenCalledWith(
      ['lib-core'],
      null
    );
    expect(runRsync).toHaveBeenCalledWith(
      '/my/projects/lib-core/dist',
      expect.stringContaining('node_modules/lib-core')
    );
    expect(patchEntrypoint).toHaveBeenCalledWith(
      expect.stringContaining('node_modules/lib-core'),
      'dist'
    );

    // Verify it saved local configuration
    expect(configManager.save).toHaveBeenCalledWith({
      mode: 'inject',
      dependencies: [{ name: 'lib-core', sourcePath: '/my/projects/lib-core' }],
    });

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('should run Sync Mode flow successfully', async () => {
    vi.mocked(select).mockResolvedValue('sync'); // select sync mode

    await runWizard();

    // Verify background compiler spawned
    expect(dependencyOrchestrator.spawnCompiler).toHaveBeenCalledWith(
      'lib-core',
      '/my/projects/lib-core',
      'npm run watch' // watchScript resolved to watch, runs as npm run watch
    );

    // Verify watcher started
    expect(dependencyOrchestrator.startWatching).toHaveBeenCalledWith(
      'lib-core',
      '/my/projects/lib-core/dist',
      expect.stringContaining('node_modules/lib-core')
    );

    // Verify Exit handlers set up
    expect(setupExitHandlers).toHaveBeenCalled();

    // Verify it saved local configuration with sync mode
    expect(configManager.save).toHaveBeenCalledWith({
      mode: 'sync',
      dependencies: [{ name: 'lib-core', sourcePath: '/my/projects/lib-core' }],
    });
  });

  test('should abort with error if Git is behind remote upstream', async () => {
    vi.mocked(getGitStatus).mockResolvedValue({
      isGit: true,
      branch: 'main',
      hasUpstream: true,
      isBehind: true,
      behindCount: 3,
    });

    await runWizard();

    // Should abort and call process.exit(1)
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    // Should NOT call backup or execution steps
    expect(backupRestoreManager.backup).not.toHaveBeenCalled();
    expect(runRsync).not.toHaveBeenCalled();
  });

  test('should abort with error if project validation fails', async () => {
    vi.mocked(validateProject).mockResolvedValue({
      isValid: false,
      packageManager: 'npm',
      projectType: 'other',
      scriptSequence: [],
      warnings: [],
      error: 'Invalid package.json',
    });

    await runWizard();

    // Should abort and call process.exit(1)
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    // Should NOT call config loading
    expect(configManager.loadGlobal).not.toHaveBeenCalled();
  });
});
