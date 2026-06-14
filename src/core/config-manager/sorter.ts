import type { PackageMetadata } from './types.js';

export function sortTopologically(
  packages: PackageMetadata[]
): PackageMetadata[] {
  const packageMap = new Map<string, PackageMetadata>();
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const pkg of packages) {
    packageMap.set(pkg.name, pkg);
    inDegree.set(pkg.name, 0);
    graph.set(pkg.name, []);
  }

  for (const pkg of packages) {
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const depName of Object.keys(allDeps)) {
      if (packageMap.has(depName)) {
        const edges = graph.get(depName);
        if (edges !== undefined) {
          edges.push(pkg.name);
        }

        const currentInDegree = inDegree.get(pkg.name) || 0;
        inDegree.set(pkg.name, currentInDegree + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const sorted: PackageMetadata[] = [];
  let processedCount = 0;

  while (queue.length > 0) {
    const currentName = queue.shift();
    if (currentName === undefined) {
      break;
    }

    const currentPkg = packageMap.get(currentName);
    if (currentPkg !== undefined) {
      sorted.push(currentPkg);
    }
    processedCount++;

    const neighbors = graph.get(currentName) || [];
    for (const neighbor of neighbors) {
      const currentInDegree = inDegree.get(neighbor) || 0;
      inDegree.set(neighbor, currentInDegree - 1);

      if (currentInDegree - 1 === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (processedCount !== packages.length) {
    throw new Error('Circular dependency detected');
  }

  return sorted;
}
