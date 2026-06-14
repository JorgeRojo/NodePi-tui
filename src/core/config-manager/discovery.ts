import fg from 'fast-glob';
import fs from 'fs/promises';

import type { PackageMetadata } from './types.js';

export async function discoverDependencies(
  containers: string[]
): Promise<PackageMetadata[]> {
  if (!containers || containers.length === 0) {
    return [];
  }

  const patterns = containers.map(container => {
    const normalized = container.replace(/\/+$/, '');
    return `${normalized}/**/package.json`;
  });

  const files = await fg(patterns, {
    ignore: ['**/node_modules/**'],
    absolute: true,
  });

  const metadatas: PackageMetadata[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const parsed = JSON.parse(content);

      if (
        parsed &&
        typeof parsed.name === 'string' &&
        typeof parsed.version === 'string'
      ) {
        const metadata: PackageMetadata = {
          name: parsed.name,
          version: parsed.version,
        };

        if (parsed.dependencies && typeof parsed.dependencies === 'object') {
          metadata.dependencies = parsed.dependencies as Record<string, string>;
        }

        if (
          parsed.devDependencies &&
          typeof parsed.devDependencies === 'object'
        ) {
          metadata.devDependencies = parsed.devDependencies as Record<
            string,
            string
          >;
        }

        if (parsed.scripts && typeof parsed.scripts === 'object') {
          metadata.scripts = parsed.scripts as Record<string, string>;
        }

        metadatas.push(metadata);
      }
    } catch {
      // Ignore unreadable or invalid files per pure data return rule, no logs
    }
  }

  return metadatas;
}
