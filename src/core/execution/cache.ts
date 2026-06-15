import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const CACHE_FILENAME = '.nodepi-cache.json';
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.nodepi-cache.json',
]);

export const hashDirectory = async (dirPath: string): Promise<string> => {
  const hash = crypto.createHash('sha256');

  const processDirectory = async (currentPath: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    // Sort to ensure deterministic hashing
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, fullPath);

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          hash.update(`${relativePath}:${stat.mtimeMs}:${stat.size}`);
        } catch {
          // Ignore unreadable files
        }
      }
    }
  };

  await processDirectory(dirPath);
  return hash.digest('hex');
};

export const isCacheValid = async (dirPath: string): Promise<boolean> => {
  const cachePath = path.join(dirPath, CACHE_FILENAME);
  try {
    const currentHash = await hashDirectory(dirPath);
    const content = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    if (
      parsed &&
      typeof parsed === 'object' &&
      'hash' in parsed &&
      typeof (parsed as Record<string, unknown>).hash === 'string'
    ) {
      return (parsed as Record<string, unknown>).hash === currentHash;
    }
    return false;
  } catch {
    return false;
  }
};

export const updateCache = async (dirPath: string): Promise<void> => {
  const cachePath = path.join(dirPath, CACHE_FILENAME);
  const hash = await hashDirectory(dirPath);
  await fs.writeFile(cachePath, JSON.stringify({ hash }, null, 2), 'utf-8');
};
