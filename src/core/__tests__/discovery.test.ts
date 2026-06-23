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

    // Create a file in containersDir to test non-directory container
    const dummyFile = path.join(containersDir, 'dummy-file.txt');
    await fs.writeFile(dummyFile, 'hello');

    // Create a directory without package.json to test exclusion
    const emptyDir = path.join(containersDir, 'empty-dir');
    await fs.mkdir(emptyDir, { recursive: true });

    // Include the file in containers list to cover !stat.isDirectory() branch
    const localPackages = await scanContainers([containersDir, dummyFile]);

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

  test('scanContainers should ignore unreadable/missing folders and malformed package.json files', async () => {
    // 1. Missing container folder
    const missingDir = path.join(tempDir, 'does-not-exist');

    // 2. Malformed package.json container folder
    const malformedDir = path.join(containersDir, 'malformed-pkg');
    await fs.mkdir(malformedDir, { recursive: true });
    await fs.writeFile(
      path.join(malformedDir, 'package.json'),
      'invalid { json'
    );

    const localPackages = await scanContainers([missingDir, containersDir]);
    expect(localPackages.size).toBe(0);
  });

  test('buildDependencyGraph should handle circular dependencies and return early from visited', async () => {
    // Setup target project package.json -> lib-a
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'target',
        dependencies: {
          'lib-a': '^1.0.0',
        },
      })
    );

    const nodeModules = path.join(targetDir, 'node_modules');
    const libADir = path.join(nodeModules, 'lib-a');
    await fs.mkdir(libADir, { recursive: true });
    // lib-a -> lib-b
    await fs.writeFile(
      path.join(libADir, 'package.json'),
      JSON.stringify({
        name: 'lib-a',
        dependencies: {
          'lib-b': '^1.0.0',
        },
      })
    );

    const libBDir = path.join(nodeModules, 'lib-b');
    await fs.mkdir(libBDir, { recursive: true });
    // lib-b -> lib-a (circular)
    await fs.writeFile(
      path.join(libBDir, 'package.json'),
      JSON.stringify({
        name: 'lib-b',
        dependencies: {
          'lib-a': '^1.0.0',
        },
      })
    );

    const graph = await buildDependencyGraph(targetDir);
    expect(graph.get('target')).toEqual(['lib-a']);
    expect(graph.get('lib-a')).toEqual(['lib-b']);
    expect(graph.get('lib-b')).toEqual(['lib-a']);
  });

  test('buildDependencyGraph should return empty graph and not crash if directory is empty or has no package.json', async () => {
    const emptyProjDir = path.join(tempDir, 'non-existent-proj');
    const graph = await buildDependencyGraph(emptyProjDir);
    expect(graph.size).toBe(0);
  });

  test('buildDependencyGraph should ignore uninstalled dependencies and not throw', async () => {
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'target',
        dependencies: {
          'non-existent-dep': '^1.0.0',
        },
      })
    );
    // Note: we don't install or place non-existent-dep inside node_modules

    const graph = await buildDependencyGraph(targetDir);
    expect(graph.get('target')).toEqual(['non-existent-dep']);
    expect(graph.get('non-existent-dep')).toBeUndefined();
  });

  test('buildDependencyGraph should fallback to folder name if package.json has no name', async () => {
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      JSON.stringify({
        name: 'target',
        dependencies: {
          'anonymous-lib': '^1.0.0',
        },
      })
    );

    const nodeModules = path.join(targetDir, 'node_modules');
    const libDir = path.join(nodeModules, 'anonymous-lib');
    await fs.mkdir(libDir, { recursive: true });
    // Write package.json without name
    await fs.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        version: '1.0.0',
      })
    );

    const graph = await buildDependencyGraph(targetDir);
    expect(graph.get('target')).toEqual(['anonymous-lib']);
    expect(graph.get('anonymous-lib')).toEqual([]);
  });

  test('findIntermediateDependencies canReach should handle missing graph keys and visited paths', () => {
    const graph = new Map<string, string[]>([
      ['target', ['lib-a', 'non-existent-neighbor']],
      ['lib-a', ['lib-a']], // Self loop
      ['lib-b', []],
    ]);
    const localPackages = new Map<string, string>([
      ['lib-b', '/path/to/lib-b'],
    ]);

    const result = findIntermediateDependencies(
      'target',
      'non-existent-dest',
      graph,
      localPackages
    );
    expect(result).toEqual([]);
  });
});
