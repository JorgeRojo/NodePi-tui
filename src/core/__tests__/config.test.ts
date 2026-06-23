import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { NodePiConfig } from '../config.js';
import { ConfigManager } from '../config.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let cwdSpy: any;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-config-' + Math.random().toString(36).slice(2)
    );
    await fs.mkdir(tempDir, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    configManager = new ConfigManager(tempDir, tempDir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test('should return default config if .nodepirc.json does not exist', async () => {
    const config = await configManager.load();
    expect(config).toEqual({
      mode: 'inject',
      dependencies: [],
    });
  });

  test('should load valid config from .nodepirc.json', async () => {
    const mockConfig: NodePiConfig = {
      mode: 'sync',
      dependencies: [
        { name: 'lib-core', sourcePath: '/path/to/lib-core' },
        { name: 'utils', sourcePath: '/path/to/utils' },
      ],
    };

    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      JSON.stringify(mockConfig, null, 2),
      'utf-8'
    );

    const config = await configManager.load();
    expect(config).toEqual(mockConfig);
  });

  test('should fallback to defaults and report error on invalid json', async () => {
    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      'invalid-json-{',
      'utf-8'
    );

    const config = await configManager.load();
    expect(config.dependencies).toEqual([]);
    expect(config.mode).toBe('inject'); // default
  });

  test('should save config to .nodepirc.json', async () => {
    const newConfig: NodePiConfig = {
      mode: 'sync',
      dependencies: [{ name: 'my-lib', sourcePath: '/my/path' }],
    };

    await configManager.save(newConfig);

    const fileContent = await fs.readFile(
      path.join(tempDir, '.nodepirc.json'),
      'utf-8'
    );
    const saved = JSON.parse(fileContent);
    expect(saved).toEqual(newConfig);
  });

  test('should return default global config if ~/.nodepirc.json does not exist', async () => {
    const globalConfig = await configManager.loadGlobal();
    expect(globalConfig).toEqual({
      containers: [],
    });
  });

  test('should load global config and resolve ~ to home directory', async () => {
    await fs.mkdir(path.join(tempDir, '.nodepi'), { recursive: true });
    // Write a mock global config inside the mocked homedir
    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      JSON.stringify({ containers: ['~/projects', '/absolute/path'] }, null, 2),
      'utf-8'
    );

    const globalConfig = await configManager.loadGlobal();
    expect(globalConfig.containers).toEqual([
      path.join(tempDir, 'projects'),
      '/absolute/path',
    ]);
  });

  test('should save global config to ~/.nodepirc.json', async () => {
    const newGlobalConfig = {
      containers: ['/some/container/dir'],
    };

    await configManager.saveGlobal(newGlobalConfig);

    const fileContent = await fs.readFile(
      path.join(tempDir, '.nodepirc.json'),
      'utf-8'
    );
    const saved = JSON.parse(fileContent);
    expect(saved).toEqual(newGlobalConfig);
  });

  test('should default dependencies to empty array if config has non-array dependencies', async () => {
    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      JSON.stringify({ mode: 'sync', dependencies: 'not-an-array' }),
      'utf-8'
    );
    const config = await configManager.load();
    expect(config.dependencies).toEqual([]);
  });

  test('should default containers to empty array if global config has non-array containers', async () => {
    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      JSON.stringify({ containers: 'not-an-array' }),
      'utf-8'
    );
    const globalConfig = await configManager.loadGlobal();
    expect(globalConfig.containers).toEqual([]);
  });

  test('should fallback to defaults and return empty containers on invalid global JSON', async () => {
    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      'invalid-global-json-{',
      'utf-8'
    );
    const globalConfig = await configManager.loadGlobal();
    expect(globalConfig.containers).toEqual([]);
  });

  test('should default mode to inject if config has an invalid mode value', async () => {
    await fs.writeFile(
      path.join(tempDir, '.nodepirc.json'),
      JSON.stringify({ mode: 'invalid-mode', dependencies: [] }),
      'utf-8'
    );
    const config = await configManager.load();
    expect(config.mode).toBe('inject');
  });
});
