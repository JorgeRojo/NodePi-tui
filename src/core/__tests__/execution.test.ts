import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  patchEntrypoint,
  restoreViteWrapper,
  runRsync,
  writeViteWrapper,
} from '../execution.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('Execution Engine', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-execution-' + Math.random().toString(36).slice(2)
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('runRsync', () => {
    test('should execute rsync command with delete and exclusions', async () => {
      await runRsync('/src/path', '/dest/path');

      expect(execa).toHaveBeenCalledWith('rsync', [
        '-ax',
        '--delete',
        '--exclude',
        'node_modules',
        '--exclude',
        '.git',
        '--exclude',
        '.nodepi',
        '/src/path/',
        '/dest/path/',
      ]);
    });

    test('should handle paths already ending with a slash', async () => {
      await runRsync('/src/path/', '/dest/path/');

      expect(execa).toHaveBeenCalledWith('rsync', [
        '-ax',
        '--delete',
        '--exclude',
        'node_modules',
        '--exclude',
        '.git',
        '--exclude',
        '.nodepi',
        '/src/path/',
        '/dest/path/',
      ]);
    });

    test('should log stdout and stderr if rsync outputs them', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: '  rsync stdout line  ',
        stderr: '  rsync stderr line  ',
      } as any);

      await runRsync('/src/path', '/dest/path');
    });
  });

  describe('patchEntrypoint', () => {
    test('should return false if package.json does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      const patched = await patchEntrypoint(nonExistentDir, 'dist');
      expect(patched).toBe(false);
    });

    test('should patch package.json if main points to a non-existent file and index.js exists in outDir', async () => {
      const depDir = path.join(tempDir, 'my-dep-invalid-main');
      await fs.mkdir(path.join(depDir, 'dist'), { recursive: true });
      await fs.writeFile(
        path.join(depDir, 'package.json'),
        JSON.stringify({ name: 'my-dep-invalid-main', main: 'non-existent.js' })
      );
      await fs.writeFile(
        path.join(depDir, 'dist', 'index.js'),
        'console.log("built");'
      );

      const patched = await patchEntrypoint(depDir, 'dist');
      expect(patched).toBe(true);

      const content = await fs.readFile(
        path.join(depDir, 'package.json'),
        'utf-8'
      );
      const pkg = JSON.parse(content);
      expect(pkg.main).toBe('dist/index.js');
    });

    test('should patch package.json if main is empty and index.js exists in outDir', async () => {
      const depDir = path.join(tempDir, 'my-dep');
      await fs.mkdir(path.join(depDir, 'dist'), { recursive: true });
      await fs.writeFile(
        path.join(depDir, 'package.json'),
        JSON.stringify({ name: 'my-dep', main: '' })
      );
      await fs.writeFile(
        path.join(depDir, 'dist', 'index.js'),
        'console.log("built");'
      );

      const patched = await patchEntrypoint(depDir, 'dist');
      expect(patched).toBe(true);

      const content = await fs.readFile(
        path.join(depDir, 'package.json'),
        'utf-8'
      );
      const pkg = JSON.parse(content);
      expect(pkg.main).toBe('dist/index.js');
    });

    test('should not patch package.json if main is already pointing to a valid file', async () => {
      const depDir = path.join(tempDir, 'my-dep');
      await fs.mkdir(depDir, { recursive: true });
      await fs.writeFile(
        path.join(depDir, 'package.json'),
        JSON.stringify({ name: 'my-dep', main: 'index.js' })
      );
      await fs.writeFile(
        path.join(depDir, 'index.js'),
        'console.log("existing");'
      );

      const patched = await patchEntrypoint(depDir, 'dist');
      expect(patched).toBe(false);

      const content = await fs.readFile(
        path.join(depDir, 'package.json'),
        'utf-8'
      );
      const pkg = JSON.parse(content);
      expect(pkg.main).toBe('index.js');
    });

    test('should return false if main is empty and index.js does not exist in outDir or package root', async () => {
      const depDir = path.join(tempDir, 'my-dep-empty');
      await fs.mkdir(depDir, { recursive: true });
      await fs.writeFile(
        path.join(depDir, 'package.json'),
        JSON.stringify({ name: 'my-dep-empty', main: '' })
      );

      const patched = await patchEntrypoint(depDir, 'dist');
      expect(patched).toBe(false);
    });
  });

  describe('Vite Config Wrapper', () => {
    test('should not throw and skip restoration if backup Vite config does not exist', async () => {
      const nonExistentConfig = path.join(tempDir, 'vite.config.ts');
      // Should not throw
      await expect(
        restoreViteWrapper(nonExistentConfig)
      ).resolves.not.toThrow();
    });

    test('should rename config and write wrapper importing the original', async () => {
      const viteConfigPath = path.join(tempDir, 'vite.config.ts');
      await fs.writeFile(viteConfigPath, 'export default { plugins: [] };');

      await writeViteWrapper(tempDir, viteConfigPath, [
        'lib-core',
        '@scope/utils',
      ]);

      const backupPath = path.join(tempDir, 'vite.config.backup.ts');
      const backupExists = await fs
        .access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      const wrapperContent = await fs.readFile(viteConfigPath, 'utf-8');
      expect(wrapperContent).toContain(
        "import originalConfig from './vite.config.backup.ts'"
      );
      expect(wrapperContent).toContain('lib-core');
      expect(wrapperContent).toContain('@scope/utils');
      expect(wrapperContent).toContain('optimizeDeps');
      expect(wrapperContent).toContain('watch');

      // Restore it
      await restoreViteWrapper(viteConfigPath);

      const restoredContent = await fs.readFile(viteConfigPath, 'utf-8');
      expect(restoredContent).toBe('export default { plugins: [] };');

      const backupStillExists = await fs
        .access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupStillExists).toBe(false);
    });
  });
});
