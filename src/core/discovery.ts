import glob from 'fast-glob';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Scans container directories for local Node.js packages.
 * Returns a map of package name to absolute source folder path.
 */
export async function scanContainers(
  containers: string[]
): Promise<Map<string, string>> {
  const localPackages = new Map<string, string>();

  for (const container of containers) {
    try {
      let resolvedDir = container;
      if (container.startsWith('~/') || container === '~') {
        resolvedDir = path.join(os.homedir(), container.slice(1));
      } else {
        resolvedDir = path.resolve(container);
      }

      const stat = await fs.stat(resolvedDir);
      if (!stat.isDirectory()) continue;

      // Scan for packages up to 2 levels deep (supporting standard and scoped packages)
      const matches = await glob(['*/package.json', '*/*/package.json'], {
        cwd: resolvedDir,
        absolute: true,
        onlyFiles: true,
      });

      for (const packageJsonPath of matches) {
        try {
          const content = await fs.readFile(packageJsonPath, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed.name) {
            localPackages.set(parsed.name, path.dirname(packageJsonPath));
          }
        } catch {
          // Ignore parse/read errors for malformed package.jsons
        }
      }
    } catch {
      // Ignore missing/unreadable container directories
    }
  }

  return localPackages;
}

/**
 * Builds a dependency graph of the target project by recursively parsing installed package.json files.
 * Returns a map of package name -> direct dependency list.
 */
export async function buildDependencyGraph(
  targetDir: string
): Promise<Map<string, string[]>> {
  const graph = new Map<string, string[]>();
  const visited = new Set<string>();

  async function traverse(
    packagePath: string,
    isRoot = false
  ): Promise<string> {
    const pkgJsonPath = path.join(packagePath, 'package.json');
    const content = await fs.readFile(pkgJsonPath, 'utf-8');
    const parsed = JSON.parse(content);
    const name = isRoot ? 'target' : (parsed.name || path.basename(packagePath));

    if (visited.has(name)) {
      return name;
    }
    visited.add(name);

    const deps = {
      ...(parsed.dependencies || {}),
      ...(isRoot ? parsed.devDependencies || {} : {}),
    };

    const directDeps = Object.keys(deps);
    graph.set(name, directDeps);

    for (const dep of directDeps) {
      try {
        let depPkgPath: string;
        try {
          // Try standard node_modules resolution
          const resolvedFile = require.resolve(`${dep}/package.json`, {
            paths: [packagePath],
          });
          depPkgPath = path.dirname(resolvedFile);
        } catch {
          // Fallback to checking target's node_modules folder directly
          depPkgPath = path.join(targetDir, 'node_modules', dep);
        }
        await traverse(depPkgPath, false);
      } catch {
        // Uninstalled dependency, ignore it
      }
    }

    return name;
  }

  try {
    await traverse(targetDir, true);
  } catch {
    // Target project has no package.json or is unreadable
  }

  return graph;
}

/**
 * Finds intermediate local dependencies that sit between the target project and a selected dependency.
 * A package is intermediate if it is reachable from target and can reach selectedPackage, and is local.
 */
export function findIntermediateDependencies(
  targetName: string,
  selectedPackage: string,
  graph: Map<string, string[]>,
  localPackages: Map<string, string>
): string[] {
  const intermediates: string[] = [];

  // Helper to check if a target node can reach a destination node in the graph
  function canReach(
    start: string,
    destination: string,
    visited = new Set<string>()
  ): boolean {
    if (start === destination) return true;
    if (visited.has(start)) return false;
    visited.add(start);

    const neighbors = graph.get(start) || [];
    for (const neighbor of neighbors) {
      if (canReach(neighbor, destination, visited)) {
        return true;
      }
    }
    return false;
  }

  // Find all packages in the graph
  for (const node of graph.keys()) {
    if (node === targetName || node === selectedPackage) {
      continue;
    }

    // Check if node lies on a path between target and selectedPackage
    if (canReach(targetName, node) && canReach(node, selectedPackage)) {
      // Check if this intermediate package is locally available
      if (localPackages.has(node)) {
        intermediates.push(node);
      }
    }
  }

  return intermediates;
}
