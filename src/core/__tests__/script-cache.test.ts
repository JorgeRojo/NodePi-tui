import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ScriptCache } from '../script-cache.js';

describe('ScriptCache', () => {
  let tempDir: string;
  let testCacheFilePath: string;
  let homedirSpy: any;
  let cache: ScriptCache;

  beforeEach(async () => {
    // Create a temporary directory in the workspace for testing
    tempDir = path.join(
      process.cwd(),
      'tmp-test-cache-' + Math.random().toString(36).slice(2)
    );
    await fs.mkdir(tempDir, { recursive: true });

    // Spy on os.homedir to redirect cache path
    homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tempDir);
    testCacheFilePath = path.join(tempDir, '.nodepi', 'scripts_cache.json');

    // Instantiate a new cache instance (it will read from mocked homedir)
    cache = new ScriptCache();
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should return null on cache miss', async () => {
    const pkgPath = path.join(tempDir, 'dummy-pkg');
    await fs.mkdir(pkgPath, { recursive: true });
    const pkgJson = { name: 'dummy-pkg', scripts: { build: 'tsc' } };

    const result = await cache.get(pkgPath, pkgJson);
    expect(result).toBeNull();
  });

  test('should store and retrieve values correctly', async () => {
    const pkgPath = path.join(tempDir, 'dummy-pkg');
    await fs.mkdir(pkgPath, { recursive: true });
    await fs.writeFile(path.join(pkgPath, 'package.json'), '{}'); // dummy to be in directory

    const pkgJson = {
      name: 'dummy-pkg',
      scripts: { build: 'tsc', watch: 'tsc -w' },
      main: 'dist/index.js',
    };

    const analysisResult = {
      buildScript: 'build',
      watchScript: 'watch',
      outDir: 'dist',
    };

    // Save to cache
    await cache.set(pkgPath, pkgJson, analysisResult);

    // Retrieve from cache
    const retrieved = await cache.get(pkgPath, pkgJson);
    expect(retrieved).toEqual(analysisResult);

    // Check that file was written to disk
    const fileExists = await fs
      .access(testCacheFilePath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  test('should invalidate cache if config files change', async () => {
    const pkgPath = path.join(tempDir, 'dummy-pkg');
    await fs.mkdir(pkgPath, { recursive: true });

    // 1. Initial state: create tsconfig.json
    const tsconfigPath = path.join(pkgPath, 'tsconfig.json');
    await fs.writeFile(
      tsconfigPath,
      JSON.stringify({ compilerOptions: { target: 'es6' } })
    );

    const pkgJson = { name: 'dummy-pkg', scripts: { build: 'tsc' } };
    const analysisResult = {
      buildScript: 'build',
      watchScript: null,
      outDir: 'dist',
    };

    await cache.set(pkgPath, pkgJson, analysisResult);

    // Cache hit
    let retrieved = await cache.get(pkgPath, pkgJson);
    expect(retrieved).toEqual(analysisResult);

    // 2. Modify tsconfig.json
    await fs.writeFile(
      tsconfigPath,
      JSON.stringify({ compilerOptions: { target: 'esnext' } })
    );

    // Cache miss (invalidation)
    retrieved = await cache.get(pkgPath, pkgJson);
    expect(retrieved).toBeNull();
  });

  test('should invalidate cache if package.json scripts change', async () => {
    const pkgPath = path.join(tempDir, 'dummy-pkg');
    await fs.mkdir(pkgPath, { recursive: true });

    const pkgJson1 = { name: 'dummy-pkg', scripts: { build: 'tsc' } };
    const pkgJson2 = { name: 'dummy-pkg', scripts: { build: 'vite build' } };
    const analysisResult = {
      buildScript: 'build',
      watchScript: null,
      outDir: 'dist',
    };

    await cache.set(pkgPath, pkgJson1, analysisResult);

    // Cache hit with pkgJson1
    let retrieved = await cache.get(pkgPath, pkgJson1);
    expect(retrieved).toEqual(analysisResult);

    // Cache miss with pkgJson2
    retrieved = await cache.get(pkgPath, pkgJson2);
    expect(retrieved).toBeNull();
  });
});
