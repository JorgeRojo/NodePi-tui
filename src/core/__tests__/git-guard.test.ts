import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getGitStatus, getVersionMismatch } from '../git-guard.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('Git & Version Guard', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-git-guard-' + Math.random().toString(36).slice(2)
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

  describe('Version Guard', () => {
    test('should detect no mismatch for equal versions', async () => {
      const localDir = path.join(tempDir, 'local');
      const targetDir = path.join(tempDir, 'target');
      await fs.mkdir(localDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });

      await fs.writeFile(
        path.join(localDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );
      await fs.writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );

      const res = await getVersionMismatch(localDir, targetDir);
      expect(res.hasMismatch).toBe(false);
      expect(res.type).toBeNull();
    });

    test('should fallback to 0.0.0 if version is missing in package.json', async () => {
      const localDir = path.join(tempDir, 'local');
      const targetDir = path.join(tempDir, 'target');
      await fs.mkdir(localDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });

      await fs.writeFile(
        path.join(localDir, 'package.json'),
        JSON.stringify({ name: 'local' }) // no version
      );
      await fs.writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify({ name: 'target' }) // no version
      );

      const res = await getVersionMismatch(localDir, targetDir);
      expect(res.hasMismatch).toBe(false);
      expect(res.localVersion).toBe('0.0.0');
      expect(res.targetVersion).toBe('0.0.0');
    });

    test('should detect major mismatch', async () => {
      const localDir = path.join(tempDir, 'local');
      const targetDir = path.join(tempDir, 'target');
      await fs.mkdir(localDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });

      await fs.writeFile(
        path.join(localDir, 'package.json'),
        JSON.stringify({ version: '2.0.0' })
      );
      await fs.writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );

      const res = await getVersionMismatch(localDir, targetDir);
      expect(res.hasMismatch).toBe(true);
      expect(res.type).toBe('major');
    });

    test('should detect minor mismatch', async () => {
      const localDir = path.join(tempDir, 'local');
      const targetDir = path.join(tempDir, 'target');
      await fs.mkdir(localDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });

      await fs.writeFile(
        path.join(localDir, 'package.json'),
        JSON.stringify({ version: '1.3.0' })
      );
      await fs.writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );

      const res = await getVersionMismatch(localDir, targetDir);
      expect(res.hasMismatch).toBe(true);
      expect(res.type).toBe('minor');
    });

    test('should detect patch mismatch', async () => {
      const localDir = path.join(tempDir, 'local');
      const targetDir = path.join(tempDir, 'target');
      await fs.mkdir(localDir, { recursive: true });
      await fs.mkdir(targetDir, { recursive: true });

      await fs.writeFile(
        path.join(localDir, 'package.json'),
        JSON.stringify({ version: '1.2.4' })
      );
      await fs.writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );

      const res = await getVersionMismatch(localDir, targetDir);
      expect(res.hasMismatch).toBe(true);
      expect(res.type).toBe('patch');
    });
  });

  describe('Git Guard', () => {
    test('should return isGit false if command throws (not a git repo)', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('not a git repo'));

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(false);
    });

    test('should return isGit false if inside-work-tree check returns false', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args.includes('--is-inside-work-tree')) {
          return Promise.resolve({ stdout: 'false' } as any);
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(false);
    });

    test('should fallback to rev-parse if branch --show-current returns empty string', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args[0] === 'rev-parse') {
          if (args.includes('--is-inside-work-tree')) {
            return Promise.resolve({ stdout: 'true' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('HEAD')) {
            return Promise.resolve({ stdout: 'detached-branch' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('@{u}')) {
            return Promise.reject(new Error('no upstream'));
          }
        }
        if (args && args.includes('--show-current')) {
          return Promise.resolve({ stdout: '' } as any); // Empty branch
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(true);
      expect(status.branch).toBe('detached-branch');
    });

    test('should return hasUpstream false if upstream is not configured', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args[0] === 'rev-parse') {
          if (args.includes('--is-inside-work-tree')) {
            return Promise.resolve({ stdout: 'true' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('@{u}')) {
            return Promise.reject(new Error('no upstream configured'));
          }
        }
        if (args && args.includes('--show-current')) {
          return Promise.resolve({ stdout: 'main' } as any);
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(true);
      expect(status.branch).toBe('main');
      expect(status.hasUpstream).toBe(false);
    });

    test('should return isBehind true if behind count > 0', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args[0] === 'rev-parse') {
          if (args.includes('--is-inside-work-tree')) {
            return Promise.resolve({ stdout: 'true' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('@{u}')) {
            return Promise.resolve({ stdout: 'origin/main' } as any);
          }
        }
        if (args && args.includes('--show-current')) {
          return Promise.resolve({ stdout: 'main' } as any);
        }
        if (args && args.includes('--count') && args.includes('HEAD..@{u}')) {
          return Promise.resolve({ stdout: '3' } as any); // 3 commits behind
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(true);
      expect(status.branch).toBe('main');
      expect(status.hasUpstream).toBe(true);
      expect(status.isBehind).toBe(true);
      expect(status.behindCount).toBe(3);
    });

    test('should return isBehind false if behind count is 0', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args[0] === 'rev-parse') {
          if (args.includes('--is-inside-work-tree')) {
            return Promise.resolve({ stdout: 'true' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('@{u}')) {
            return Promise.resolve({ stdout: 'origin/main' } as any);
          }
        }
        if (args && args.includes('--show-current')) {
          return Promise.resolve({ stdout: 'main' } as any);
        }
        if (args && args.includes('--count') && args.includes('HEAD..@{u}')) {
          return Promise.resolve({ stdout: '0' } as any);
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(true);
      expect(status.hasUpstream).toBe(true);
      expect(status.isBehind).toBe(false);
      expect(status.behindCount).toBe(0);
    });

    test('should fallback and ignore errors if branch check throws', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args[0] === 'rev-parse') {
          if (args.includes('--is-inside-work-tree')) {
            return Promise.resolve({ stdout: 'true' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('@{u}')) {
            return Promise.resolve({ stdout: 'origin/main' } as any);
          }
          // Make rev-parse --abbrev-ref HEAD throw
          if (args.includes('--abbrev-ref') && args.includes('HEAD')) {
            return Promise.reject(new Error('no branch'));
          }
        }
        if (args && args.includes('--show-current')) {
          // Make git branch --show-current throw
          return Promise.reject(new Error('no branch'));
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(true);
      expect(status.branch).toBe('unknown'); // fallback
    });

    test('should fallback to isBehind false if behind count check throws', async () => {
      vi.mocked(execa).mockImplementation(((cmd: any, args: any) => {
        if (args && args[0] === 'rev-parse') {
          if (args.includes('--is-inside-work-tree')) {
            return Promise.resolve({ stdout: 'true' } as any);
          }
          if (args.includes('--abbrev-ref') && args.includes('@{u}')) {
            return Promise.resolve({ stdout: 'origin/main' } as any);
          }
        }
        if (args && args.includes('--show-current')) {
          return Promise.resolve({ stdout: 'main' } as any);
        }
        if (args && args.includes('--count')) {
          return Promise.reject(new Error('count error'));
        }
        return Promise.resolve({ stdout: '' } as any);
      }) as any);

      const status = await getGitStatus('/some/path');
      expect(status.isGit).toBe(true);
      expect(status.hasUpstream).toBe(true);
      expect(status.isBehind).toBe(false);
    });
  });
});
