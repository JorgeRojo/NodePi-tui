import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BackupRestoreManager } from '../backup-restore.js';

describe('BackupRestoreManager', () => {
  let tempDir: string;
  let cwdSpy: any;
  let manager: BackupRestoreManager;

  beforeEach(() => {
    // Create a temporary directory for each test to isolate FS operations
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-backup-' + Math.random().toString(36).slice(2)
    );
    fs.mkdirSync(tempDir, { recursive: true });

    // Spy on process.cwd() to point to the temp directory
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    // Instantiate a new manager with the mocked process.cwd()
    manager = new BackupRestoreManager();
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should initially report no backup', () => {
    expect(manager.hasBackup()).toBe(false);
    expect(manager.loadMetadata()).toBeNull();
  });

  test('should backup and restore dependencies correctly', () => {
    // 1. Create a dummy node_modules with dependencies to inject
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const depDir = path.join(nodeModulesDir, 'my-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, 'index.js'), 'console.log("original");');

    // Verify setup
    expect(fs.existsSync(path.join(depDir, 'index.js'))).toBe(true);

    // 2. Perform backup
    manager.backup(['my-dep'], null);

    // Verify backup files exist and original was moved
    expect(manager.hasBackup()).toBe(true);
    expect(fs.existsSync(depDir)).toBe(false); // Should be moved

    const meta = manager.loadMetadata();
    expect(meta).not.toBeNull();
    expect(meta!.dependencies).toHaveLength(1);
    expect(meta!.dependencies[0].name).toBe('my-dep');
    expect(meta!.dependencies[0].originalExists).toBe(true);

    // Simulate NodePi writing injected code to target
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, 'index.js'), 'console.log("injected");');

    // 3. Perform restore
    manager.restore();

    // Verify original is restored and injected code is gone
    expect(fs.existsSync(path.join(depDir, 'index.js'))).toBe(true);
    const content = fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8');
    expect(content).toContain('original');

    // Verify cleanup
    expect(manager.hasBackup()).toBe(false);
  });

  test('should handle scoped packages during backup and restore', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const scopeDir = path.join(nodeModulesDir, '@myscope');
    const depDir = path.join(scopeDir, 'my-scoped-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, 'index.js'),
      'console.log("scoped-original");'
    );

    // Backup
    manager.backup(['@myscope/my-scoped-dep'], null);

    expect(fs.existsSync(depDir)).toBe(false);

    // Restore
    manager.restore();

    expect(fs.existsSync(path.join(depDir, 'index.js'))).toBe(true);
    const content = fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8');
    expect(content).toContain('scoped-original');
  });

  test('should backup and restore Vite config if specified', () => {
    const viteConfigPath = path.join(tempDir, 'vite.config.ts');
    fs.writeFileSync(viteConfigPath, 'export default {};');

    // Backup
    manager.backup([], viteConfigPath);

    // Restore
    manager.restore();

    expect(fs.existsSync(viteConfigPath)).toBe(true);
    const content = fs.readFileSync(viteConfigPath, 'utf-8');
    expect(content).toContain('export default {};');
  });

  test('should handle dependencies that do not exist originally', () => {
    // Dependency does not exist in node_modules
    manager.backup(['non-existent-dep'], null);

    const meta = manager.loadMetadata();
    expect(meta!.dependencies[0].originalExists).toBe(false);

    // Simulated inject: NodePi writes it
    const depPath = path.join(tempDir, 'node_modules', 'non-existent-dep');
    fs.mkdirSync(depPath, { recursive: true });
    fs.writeFileSync(path.join(depPath, 'index.js'), 'console.log("new");');

    // Restore
    manager.restore();

    // After restore, since it did not exist originally, it should be deleted
    expect(fs.existsSync(depPath)).toBe(false);
  });

  test('should fall back to cpSync + rmSync if renameSync fails with EXDEV', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const depDir = path.join(nodeModulesDir, 'exdev-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, 'index.js'), 'console.log("exdev");');

    // Force renameSync to throw EXDEV on first call
    const originalRename = fs.renameSync;
    const renameSpy = vi
      .spyOn(fs, 'renameSync')
      .mockImplementation((src, dest) => {
        const err = new Error('EXDEV: cross-device link not permitted') as any;
        err.code = 'EXDEV';
        throw err;
      });

    // Backup
    manager.backup(['exdev-dep'], null);

    // Restore renameSync
    renameSpy.mockRestore();

    // Verify copy succeeded
    const backupDir = path.join(
      tempDir,
      '.nodepi',
      'backups',
      'node_modules',
      'exdev-dep'
    );
    expect(fs.existsSync(backupDir)).toBe(true);
    expect(fs.existsSync(path.join(backupDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(depDir)).toBe(false); // Original should be removed
  });

  test('should fall back to cpSync + rmSync if renameSync fails with EXDEV during restore', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const depDir = path.join(nodeModulesDir, 'restore-exdev-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, 'index.js'),
      'console.log("exdev-restore");'
    );

    // Backup normally
    manager.backup(['restore-exdev-dep'], null);

    // Mock renameSync to fail with EXDEV on restore
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      const err = new Error('EXDEV error') as any;
      err.code = 'EXDEV';
      throw err;
    });

    // Restore should fall back to cpSync and rmSync and succeed
    expect(() => manager.restore()).not.toThrow();

    renameSpy.mockRestore();

    expect(fs.existsSync(path.join(depDir, 'index.js'))).toBe(true);
    const content = fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8');
    expect(content).toContain('exdev-restore');
  });

  test('should rethrow non-EXDEV errors if renameSync fails during restore', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const depDir = path.join(nodeModulesDir, 'restore-fail-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, 'index.js'), 'original');

    manager.backup(['restore-fail-dep'], null);

    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    expect(() => manager.restore()).toThrow('EACCES: permission denied');

    renameSpy.mockRestore();
  });

  test('should log but not throw if cleanup fails during restore', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const depDir = path.join(nodeModulesDir, 'restore-cleanup-dep');
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, 'index.js'), 'original');

    manager.backup(['restore-cleanup-dep'], null);

    // Mock fs.rmSync during cleanup to throw an error
    const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation((path, options) => {
      // Throw only when trying to delete the backups folder
      if (typeof path === 'string' && path.includes('.nodepi')) {
        throw new Error('cannot delete backups');
      }
      return undefined as any;
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => manager.restore()).not.toThrow();

    rmSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test('should abort restore if no backup metadata is found', () => {
    // Ensure metadata file does not exist
    const metaPath = (manager as any).metaPath;
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }

    expect(() => manager.restore()).not.toThrow();
  });

  test('should log but not throw if unlinking temp Vite backup config fails', () => {
    const viteConfigPath = path.join(tempDir, 'vite.config.ts');
    fs.writeFileSync(viteConfigPath, 'export default {};');

    // Perform backup with Vite config
    manager.backup([], viteConfigPath);

    // Create the temporary wrapper backup config that unlinkSync will try to delete
    // The name matches: filename.replace(/\.(ts|js|mjs|cjs)$/, '.backup.$1') -> vite.backup.config.ts
    // Wait, path.basename(viteConfigPath) is "vite.config.ts".
    // filename.replace(/\.(ts|js|mjs|cjs)$/, '.backup.$1') results in: "vite.config.backup.ts"!
    // Let's check: filename is "vite.config.ts".
    // filename.replace(/\.(ts|js|mjs|cjs)$/, '.backup.$1') matches ".ts" at the end, and replaces it with ".backup.ts".
    // So "vite.config.ts" -> "vite.config.backup.ts"!
    const backupConfigPath = path.join(tempDir, 'vite.config.backup.ts');
    fs.writeFileSync(backupConfigPath, 'backup content');

    // Mock unlinkSync to throw error for the backup config
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(path => {
      if (typeof path === 'string' && path.includes('vite.config.backup.ts')) {
        throw new Error('unlink failed');
      }
      return originalUnlink(path);
    });

    const originalUnlink = fs.unlinkSync;

    expect(() => manager.restore()).not.toThrow();

    unlinkSpy.mockRestore();
  });

  test('should log error and return null if reading backup metadata throws', () => {
    // Mock hasBackup to return true so it enters the try-catch block in loadMetadata
    const hasBackupSpy = vi.spyOn(manager, 'hasBackup').mockReturnValue(true);

    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('read error');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(manager.loadMetadata()).toBeNull();

    hasBackupSpy.mockRestore();
    readSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test('should rethrow non-EXDEV errors if renameSync fails during backup', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const depDir = path.join(nodeModulesDir, 'fail-dep');
    fs.mkdirSync(depDir, { recursive: true });

    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    expect(() => manager.backup(['fail-dep'], null)).toThrow(
      'EACCES: permission denied'
    );

    renameSpy.mockRestore();
  });
});
