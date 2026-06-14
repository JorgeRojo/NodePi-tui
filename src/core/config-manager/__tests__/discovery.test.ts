import { afterEach, describe, expect, it, vi } from 'vitest';
import fg from 'fast-glob';
import fs from 'fs/promises';

import { discoverDependencies } from '../discovery.js';

vi.mock('fast-glob');
vi.mock('fs/promises');

describe('discoverDependencies', () => {
  const mockedFg = vi.mocked(fg);
  const mockedReadFile = vi.mocked(fs.readFile);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty array if containers is empty', async () => {
    const result = await discoverDependencies([]);
    expect(result).toEqual([]);
    expect(mockedFg).not.toHaveBeenCalled();
  });

  it('should use fast-glob with correct patterns and exclude node_modules', async () => {
    mockedFg.mockResolvedValue([]);

    await discoverDependencies(['apps', 'packages/']);

    expect(mockedFg).toHaveBeenCalledWith(
      ['apps/**/package.json', 'packages/**/package.json'],
      expect.objectContaining({
        ignore: ['**/node_modules/**'],
        absolute: true,
      })
    );
  });

  it('should parse valid package.json files and return metadata', async () => {
    mockedFg.mockResolvedValue([
      '/apps/app1/package.json',
      '/packages/pkg1/package.json',
    ]);

    mockedReadFile.mockImplementation(async path => {
      if (path === '/apps/app1/package.json') {
        return JSON.stringify({
          name: 'app1',
          version: '1.0.0',
          dependencies: { pkg1: '1.0.0' },
          scripts: { start: 'node index.js' },
        });
      }
      if (path === '/packages/pkg1/package.json') {
        return JSON.stringify({
          name: 'pkg1',
          version: '1.0.0',
          devDependencies: { typescript: '^5.0.0' },
        });
      }
      throw new Error('Not found');
    });

    const result = await discoverDependencies(['apps', 'packages']);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'app1',
      version: '1.0.0',
      dependencies: { pkg1: '1.0.0' },
      scripts: { start: 'node index.js' },
    });
    expect(result[1]).toEqual({
      name: 'pkg1',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    });
  });

  it('should ignore files that cannot be read or contain invalid JSON', async () => {
    mockedFg.mockResolvedValue([
      '/apps/app1/package.json',
      '/apps/app2/package.json',
    ]);

    mockedReadFile.mockImplementation(async path => {
      if (path === '/apps/app1/package.json') {
        return 'invalid json';
      }
      if (path === '/apps/app2/package.json') {
        throw new Error('Permission denied');
      }
      return '';
    });

    const result = await discoverDependencies(['apps']);
    expect(result).toEqual([]);
  });

  it('should ignore package.json without name or version', async () => {
    mockedFg.mockResolvedValue([
      '/apps/app1/package.json',
      '/apps/app2/package.json',
    ]);

    mockedReadFile.mockImplementation(async path => {
      if (path === '/apps/app1/package.json') {
        return JSON.stringify({ version: '1.0.0' }); // missing name
      }
      if (path === '/apps/app2/package.json') {
        return JSON.stringify({ name: 'app2' }); // missing version
      }
      return '';
    });

    const result = await discoverDependencies(['apps']);
    expect(result).toEqual([]);
  });
});
