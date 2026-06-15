import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stats } from 'node:fs';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { backupTarget, restoreTargetSync } from '../backupManager.js';

vi.mock('node:fs/promises');
vi.mock('node:fs');

describe('Backup Manager', () => {
  const mockCwd = '/mock/cwd';
  const mockBackupDir = path.join(mockCwd, '.nodepi-backup');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('backupTarget', () => {
    it('should backup package.json, pnpm-lock.yaml, and specified dependencies', async () => {
      const mockRm = vi.mocked(fs.rm);
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockCp = vi.mocked(fs.cp);

      mockRm.mockResolvedValue(undefined);
      mockMkdir.mockResolvedValue(undefined);
      mockCp.mockResolvedValue(undefined);

      await backupTarget(mockCwd, ['dep-a', '@scope/dep-b']);

      expect(mockRm).toHaveBeenCalledWith(mockBackupDir, {
        recursive: true,
        force: true,
      });
      expect(mockMkdir).toHaveBeenCalledWith(mockBackupDir, {
        recursive: true,
      });

      // Check package files
      expect(mockCp).toHaveBeenCalledWith(
        path.join(mockCwd, 'package.json'),
        path.join(mockBackupDir, 'package.json'),
        { recursive: true, force: true }
      );
      expect(mockCp).toHaveBeenCalledWith(
        path.join(mockCwd, 'pnpm-lock.yaml'),
        path.join(mockBackupDir, 'pnpm-lock.yaml'),
        { recursive: true, force: true }
      );

      // Check deps
      expect(mockCp).toHaveBeenCalledWith(
        path.join(mockCwd, 'node_modules', 'dep-a'),
        path.join(mockBackupDir, 'node_modules', 'dep-a'),
        { recursive: true, force: true }
      );
      expect(mockCp).toHaveBeenCalledWith(
        path.join(mockCwd, 'node_modules', '@scope/dep-b'),
        path.join(mockBackupDir, 'node_modules', '@scope/dep-b'),
        { recursive: true, force: true }
      );
    });

    it('should gracefully handle missing files during copy', async () => {
      const mockRm = vi.mocked(fs.rm);
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockCp = vi.mocked(fs.cp);

      mockRm.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue(undefined);
      mockCp.mockRejectedValue(new Error('ENOENT'));

      await backupTarget(mockCwd, ['dep-a']);

      expect(mockRm).toHaveBeenCalledWith(mockBackupDir, {
        recursive: true,
        force: true,
      });
      expect(mockCp).toHaveBeenCalled(); // Should not throw
    });
  });

  describe('restoreTargetSync', () => {
    it('should do nothing if backup dir does not exist', () => {
      const mockStatSync = vi.mocked(fsSync.statSync) as MockedFunction<
        typeof fsSync.statSync
      >;
      mockStatSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const mockCpSync = vi.mocked(fsSync.cpSync);

      restoreTargetSync(mockCwd);

      expect(mockCpSync).not.toHaveBeenCalled();
    });

    it('should do nothing if backup dir is not a directory', () => {
      const mockStatSync = vi.mocked(fsSync.statSync) as MockedFunction<
        typeof fsSync.statSync
      >;
      mockStatSync.mockImplementation(() => {
        return { isDirectory: () => false } as Stats;
      });

      const mockCpSync = vi.mocked(fsSync.cpSync);

      restoreTargetSync(mockCwd);

      expect(mockCpSync).not.toHaveBeenCalled();
    });

    it('should synchronously restore files and remove vite config', () => {
      const mockStatSync = vi.mocked(fsSync.statSync) as MockedFunction<
        typeof fsSync.statSync
      >;
      mockStatSync.mockImplementation(() => {
        return { isDirectory: () => true } as Stats;
      });

      const mockReaddirSync = vi.mocked(fsSync.readdirSync) as MockedFunction<
        typeof fsSync.readdirSync
      >;
      mockReaddirSync.mockImplementation((dir: unknown) => {
        if (dir === path.join(mockBackupDir, 'node_modules')) {
          return ['dep-a', '@scope'] as never;
        }
        return [] as never;
      });

      const mockCpSync = vi.mocked(fsSync.cpSync);
      const mockRmSync = vi.mocked(fsSync.rmSync);

      restoreTargetSync(mockCwd);

      expect(mockCpSync).toHaveBeenCalledWith(
        path.join(mockBackupDir, 'package.json'),
        path.join(mockCwd, 'package.json'),
        { recursive: true, force: true }
      );
      expect(mockCpSync).toHaveBeenCalledWith(
        path.join(mockBackupDir, 'pnpm-lock.yaml'),
        path.join(mockCwd, 'pnpm-lock.yaml'),
        { recursive: true, force: true }
      );
      expect(mockCpSync).toHaveBeenCalledWith(
        path.join(mockBackupDir, 'node_modules', 'dep-a'),
        path.join(mockCwd, 'node_modules', 'dep-a'),
        { recursive: true, force: true }
      );
      expect(mockCpSync).toHaveBeenCalledWith(
        path.join(mockBackupDir, 'node_modules', '@scope'),
        path.join(mockCwd, 'node_modules', '@scope'),
        { recursive: true, force: true }
      );

      expect(mockRmSync).toHaveBeenCalledWith(
        path.join(mockCwd, '.vite.config.nodepi.ts'),
        { force: true }
      );
    });

    it('should ignore errors during individual copy and remove operations', () => {
      const mockStatSync = vi.mocked(fsSync.statSync) as MockedFunction<
        typeof fsSync.statSync
      >;
      mockStatSync.mockImplementation(() => {
        return { isDirectory: () => true } as Stats;
      });

      const mockReaddirSync = vi.mocked(fsSync.readdirSync) as MockedFunction<
        typeof fsSync.readdirSync
      >;
      mockReaddirSync.mockImplementation(() => {
        return ['dep-a'] as never;
      });

      const mockCpSync = vi.mocked(fsSync.cpSync);
      mockCpSync.mockImplementation(() => {
        throw new Error('Copy failed');
      });

      const mockRmSync = vi.mocked(fsSync.rmSync);
      mockRmSync.mockImplementation(() => {
        throw new Error('Remove failed');
      });

      // Should not throw
      restoreTargetSync(mockCwd);

      expect(mockCpSync).toHaveBeenCalled();
      expect(mockRmSync).toHaveBeenCalled();
    });

    it('should handle missing backup node_modules gracefully', () => {
      const mockStatSync = vi.mocked(fsSync.statSync) as MockedFunction<
        typeof fsSync.statSync
      >;
      mockStatSync.mockImplementation(() => {
        return { isDirectory: () => true } as Stats;
      });

      const mockReaddirSync = vi.mocked(fsSync.readdirSync) as MockedFunction<
        typeof fsSync.readdirSync
      >;
      mockReaddirSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const mockCpSync = vi.mocked(fsSync.cpSync);

      restoreTargetSync(mockCwd);

      // It should still copy package.json and pnpm-lock.yaml
      expect(mockCpSync).toHaveBeenCalledWith(
        path.join(mockBackupDir, 'package.json'),
        path.join(mockCwd, 'package.json'),
        { recursive: true, force: true }
      );
    });
  });
});
