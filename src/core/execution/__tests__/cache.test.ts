import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dirent, Stats } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { hashDirectory, isCacheValid, updateCache } from '../cache.js';

vi.mock('fs/promises');

describe('Cache Manager', () => {
  const mockDirPath = '/mock/dir';
  const mockCachePath = path.join(mockDirPath, '.nodepi-cache.json');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('hashDirectory', () => {
    it('should calculate hash based on directory contents and ignore ignored dirs', async () => {
      const mockReaddir = vi.mocked(fs.readdir) as MockedFunction<
        typeof fs.readdir
      >;
      const mockStat = vi.mocked(fs.stat) as MockedFunction<typeof fs.stat>;

      mockReaddir.mockImplementation((async (dir: any) => {
        if (dir === mockDirPath) {
          return [
            { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
            {
              name: 'node_modules',
              isDirectory: () => true,
              isFile: () => false,
            },
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
          ] as unknown as Dirent[];
        }
        if (dir === path.join(mockDirPath, 'subdir')) {
          return [
            { name: 'file2.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as Dirent[];
        }
        return [] as unknown as Dirent[];
      }) as any);

      mockStat.mockImplementation((async () => {
        return { mtimeMs: 12345, size: 100 } as unknown as Stats;
      }) as any);

      const hash = await hashDirectory(mockDirPath);
      expect(hash).toBeTypeOf('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(mockReaddir).toHaveBeenCalledTimes(2);
      expect(mockStat).toHaveBeenCalledTimes(2);
    });

    it('should handle unreadable directories gracefully', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockRejectedValue(new Error('Access denied'));
      const hash = await hashDirectory(mockDirPath);
      expect(hash).toBeTypeOf('string');
    });

    it('should handle unreadable files gracefully', async () => {
      const mockReaddir = vi.mocked(fs.readdir) as MockedFunction<
        typeof fs.readdir
      >;
      const mockStat = vi.mocked(fs.stat) as MockedFunction<typeof fs.stat>;

      mockReaddir.mockImplementation((async (dir: any) => {
        if (dir === mockDirPath) {
          return [
            { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
          ] as unknown as Dirent[];
        }
        return [] as unknown as Dirent[];
      }) as any);

      mockStat.mockRejectedValue(new Error('Access denied'));

      const hash = await hashDirectory(mockDirPath);
      expect(hash).toBeTypeOf('string');
      expect(mockReaddir).toHaveBeenCalledTimes(1);
      expect(mockStat).toHaveBeenCalledTimes(1);
    });
  });

  describe('isCacheValid', () => {
    it('should return true if cache matches current hash', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);
      const currentHash = await hashDirectory(mockDirPath);

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(JSON.stringify({ hash: currentHash }));

      const result = await isCacheValid(mockDirPath);
      expect(result).toBe(true);
      expect(mockReadFile).toHaveBeenCalledWith(mockCachePath, 'utf-8');
    });

    it('should return false if cache is missing', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      const result = await isCacheValid(mockDirPath);
      expect(result).toBe(false);
    });

    it('should return false if cache is invalid JSON', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue('invalid-json');
      const result = await isCacheValid(mockDirPath);
      expect(result).toBe(false);
    });

    it('should return false if hash mismatches', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(JSON.stringify({ hash: 'old-hash' }));

      const result = await isCacheValid(mockDirPath);
      expect(result).toBe(false);
    });
  });

  describe('updateCache', () => {
    it('should write current hash to cache file', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([]);
      const currentHash = await hashDirectory(mockDirPath);

      const mockWriteFile = vi.mocked(fs.writeFile);
      await updateCache(mockDirPath);

      expect(mockWriteFile).toHaveBeenCalledWith(
        mockCachePath,
        JSON.stringify({ hash: currentHash }, null, 2),
        'utf-8'
      );
    });
  });
});
