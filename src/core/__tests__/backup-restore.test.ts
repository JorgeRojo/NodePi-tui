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
});
