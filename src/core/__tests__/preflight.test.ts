import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { confirm } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { backupRestoreManager } from '../backup-restore.js';
import { runPreflight } from '../preflight.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  confirm: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../backup-restore.js', () => ({
  backupRestoreManager: {
    hasBackup: vi.fn(),
    restore: vi.fn(),
  },
}));

describe('Preflight Checks', () => {
  let tempDir: string;
  let cwdSpy: any;
  let exitSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-preflight-' + Math.random().toString(36).slice(2)
    );
    fs.mkdirSync(tempDir, { recursive: true });

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    vi.mocked(backupRestoreManager.hasBackup).mockReturnValue(false);
    vi.mocked(execa).mockResolvedValue({} as any); // Command exists by default
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    cwdSpy.mockRestore();
    exitSpy.mockRestore();
    vi.clearAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test('should pass and return correct result when all tools exist and no Vite is present', async () => {
    const result = await runPreflight();

    expect(result.isViteProject).toBe(false);
    expect(result.viteConfigPath).toBeNull();
    expect(result.hasAgy).toBe(true); // Since execa did not throw
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('should detect Vite project if vite.config.ts exists', async () => {
    const viteConfigPath = path.join(tempDir, 'vite.config.ts');
    fs.writeFileSync(viteConfigPath, 'export default {}');

    const result = await runPreflight();

    expect(result.isViteProject).toBe(true);
    expect(result.viteConfigPath).toBe(viteConfigPath);
  });

  test('should exit if required tools (rsync) are missing', async () => {
    // Mock execa to throw (missing tool) when checked for rsync
    vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
      if (args && args[0] === 'rsync') {
        throw new Error('command not found');
      }
      return Promise.resolve({} as any);
    }) as any);

    await runPreflight();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('should trigger restore if backup is found and user confirms', async () => {
    vi.mocked(backupRestoreManager.hasBackup).mockReturnValue(true);
    vi.mocked(confirm).mockResolvedValue(true);

    await runPreflight();

    expect(backupRestoreManager.restore).toHaveBeenCalled();
  });

  test('should skip restore if backup is found and user declines', async () => {
    vi.mocked(backupRestoreManager.hasBackup).mockReturnValue(true);
    vi.mocked(confirm).mockResolvedValue(false);

    await runPreflight();

    expect(backupRestoreManager.restore).not.toHaveBeenCalled();
  });
});
