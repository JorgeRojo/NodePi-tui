import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

import { readConfig, writeConfig } from '../io.js';

vi.mock('fs/promises');

describe('Config Manager I/O', () => {
  const basePath = '/mock/base/path';
  const configPath = path.join(basePath, '.nodepirc.json');
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('writeConfig', () => {
    it('should write the config object as formatted JSON', async () => {
      const config = { containers: ['/app/1', '/app/2'] };
      await writeConfig(basePath, config);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });
  });

  describe('readConfig', () => {
    it('should read and parse a valid config file', async () => {
      const validConfig = { containers: ['/app/1'] };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(validConfig));

      const result = await readConfig(basePath);

      expect(mockFs.readFile).toHaveBeenCalledWith(configPath, 'utf-8');
      expect(result).toEqual({
        ...validConfig,
        customScripts: [],
        dependencies: undefined,
      });
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should gracefully handle missing file by creating and returning a default template', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValueOnce(error);

      const result = await readConfig(basePath);

      expect(result).toEqual({ containers: [], customScripts: [] });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({ containers: [], customScripts: [] }, null, 2),
        'utf-8'
      );
    });

    it('should return a default template if file contains invalid JSON', async () => {
      mockFs.readFile.mockResolvedValueOnce('invalid json');

      const result = await readConfig(basePath);

      expect(result).toEqual({ containers: [], customScripts: [] });
    });

    it('should return a default template if parsed JSON is not an object', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(123));
      const result = await readConfig(basePath);
      expect(result).toEqual({ containers: [], customScripts: [] });
    });

    it('should return a default template if containers is missing or not an array', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ other: true }));
      const result = await readConfig(basePath);
      expect(result).toEqual({ containers: [], customScripts: [] });
    });

    it('should filter out non-string items from containers array', async () => {
      const mixedConfig = { containers: ['/app/1', 123, null, '/app/2'] };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mixedConfig));

      const result = await readConfig(basePath);

      expect(result).toEqual({
        containers: ['/app/1', '/app/2'],
        customScripts: [],
      });
    });

    it('should extract valid custom scripts', async () => {
      const configWithScripts = {
        containers: ['/app/1'],
        customScripts: [
          { type: 'test', name: 'valid', command: 'echo 1' },
          { invalid: 'script' },
        ],
      };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(configWithScripts));

      const result = await readConfig(basePath);

      expect(result.customScripts).toEqual([
        { type: 'test', name: 'valid', command: 'echo 1' },
      ]);
    });
  });
});
