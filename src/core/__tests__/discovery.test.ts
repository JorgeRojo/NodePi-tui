import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildDependencyGraph,
  findIntermediateDependencies,
  scanContainers,
} from '../discovery.js';

describe('Dependency Discovery', () => {
  let tempDir: string;
  let containersDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-discovery-' + Math.random().toString(36).slice(2)
    );
    await fs.mkdir(tempDir, { recursive: true });

    // Setup global containers directory
    containersDir = path.join(tempDir, 'global-containers');
    await fs.mkdir(containersDir, { recursive: true });

    // Setup target project directory
    targetDir = path.join(tempDir, 'target-project');
    await fs.mkdir(targetDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test('scanContainers should map package names to local paths', async () => {
    // Create 2 local packages in container dir
    const pkgADir = path.join(containersDir, 'package-a');
    await fs.mkdir(pkgADir, { recursive: true });
    await fs.writeFile(
      path.join(pkgADir, 'package.json'),
      JSON.stringify({ name: 'lib-a', version: '1.0.0' })
    );

    const pkgBDir = path.join(containersDir, 'package-b');
    await fs.mkdir(pkgBDir, { recursive: true });
    await fs.writeFile(
      path.join(pkgBDir, 'package.json'),
      JSON.stringify({ name: '@scope/lib-b', version: '2.0.0' })
    );

    // Create a directory without package.json to test exclusion
    const emptyDir = path.join(containersDir, 'empty-dir');
    await fs.mkdir(emptyDir, { recursive: true });

    const localPackages = await scanContainers([containersDir]);

    expect(localPackages.size).toBe(2);
    expect(localPackages.get('lib-a')).toBe(pkgADir);
    expect(localPackages.get('@scope/lib-b')).toBe(pkgBDir);
  });

  test('scanContainers should resolve tilde (~) path to homedir', async () => {
    const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(containersDir);

    // Create a package in containersDir/package-c
    const pkgCDir = path.join(containersDir, 'package-c');
    await fs.mkdir(pkgCDir, { recursive: true });
    await fs.writeFile(
      path.join(pkgCDir, 'package.json'),
      JSON.stringify({ name: 'lib-c', version: '3.0.0' })
    );

    // Call scanContainers with tilde path
    const localPackages = await scanContainers(['~']);

    expect(localPackages.size).toBe(1);
    expect(localPackages.get('lib-c')).toBe(pkgCDir);

    homedirSpy.mockRestore();
  });

  test('buildDependencyGraph should construct dependencies tree', async () => {
    // Setup target project package.json
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'target',
        dependencies: {
          'lib-a': '^1.0.0',
        },
      })
    );

    // Setup target node_modules
    const nodeModules = path.join(targetDir, 'node_modules');
    const libADir = path.join(nodeModules, 'lib-a');
    await fs.mkdir(libADir, { recursive: true });
    await fs.writeFile(
      path.join(libADir, 'package.json'),
      JSON.stringify({
        name: 'lib-a',
        dependencies: {
          'lib-b': '^2.0.0',
        },
      })
    );

    const libBDir = path.join(nodeModules, 'lib-b');
    await fs.mkdir(libBDir, { recursive: true });
    await fs.writeFile(
      path.join(libBDir, 'package.json'),
      JSON.stringify({
        name: 'lib-b',
      })
    );

    const graph = await buildDependencyGraph(targetDir);

    expect(graph.get('target')).toEqual(['lib-a']);
    expect(graph.get('lib-a')).toEqual(['lib-b']);
    expect(graph.get('lib-b')).toEqual([]);
  });

  test('findIntermediateDependencies should resolve local packages along transitive path', async () => {
    // Local package map
    const localPackages = new Map<string, string>([
      ['lib-a', '/path/to/lib-a'],
      ['lib-b', '/path/to/lib-b'],
      ['lib-c', '/path/to/lib-c'],
    ]);

    // Setup Target -> lib-a -> lib-b -> lib-c (where lib-c is selected)
    // We want to find if there are intermediate packages (lib-a, lib-b) that are also local
    const graph = new Map<string, string[]>([
      ['target', ['lib-a', 'other-dep']],
      ['lib-a', ['lib-b']],
      ['lib-b', ['lib-c']],
      ['lib-c', []],
      ['other-dep', []],
    ]);

    // If we select lib-c, the intermediate local packages should be lib-a and lib-b
    const intermediate = findIntermediateDependencies(
      'target',
      'lib-c',
      graph,
      localPackages
    );

    expect(intermediate).toContain('lib-a');
    expect(intermediate).toContain('lib-b');
    expect(intermediate).not.toContain('lib-c');
    expect(intermediate).not.toContain('other-dep');
  });

  test('buildDependencyGraph should key the root project as target even with a custom name in package.json', async () => {
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'custom-name-app',
        dependencies: {
          'lib-a': '^1.0.0',
        },
      })
    );

    const nodeModules = path.join(targetDir, 'node_modules');
    const libADir = path.join(nodeModules, 'lib-a');
    await fs.mkdir(libADir, { recursive: true });
    await fs.writeFile(
      path.join(libADir, 'package.json'),
      JSON.stringify({
        name: 'lib-a',
      })
    );

    const graph = await buildDependencyGraph(targetDir);

    expect(graph.get('target')).toEqual(['lib-a']);
    expect(graph.get('custom-name-app')).toBeUndefined();
  });
});
