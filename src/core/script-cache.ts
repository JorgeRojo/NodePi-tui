import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface ScriptAnalysisResult {
  watchScript: string | null;
  buildScript: string | null;
  outDir: string;
}

export interface CacheEntry {
  hash: string;
  result: ScriptAnalysisResult;
}

type CacheStore = Record<string, CacheEntry>;

export class ScriptCache {
  private cacheFilePath: string;
  private memoryCache: CacheStore | null = null;

  constructor() {
    // Suggest saving this in a global directory to share the cache across multiple projects
    const globalDir = path.join(os.homedir(), '.nodepi');
    this.cacheFilePath = path.join(globalDir, 'scripts_cache.json');
  }

  /**
   * Generates a SHA-256 hash from the relevant fields that define if the build changes.
   */
  private async generateHash(
    packagePath: string,
    packageJson: any
  ): Promise<string> {
    const relevantData = {
      scripts: packageJson.scripts || {},
      main: packageJson.main,
      module: packageJson.module,
      exports: packageJson.exports,
    };

    const hasher = createHash('sha256');
    hasher.update(JSON.stringify(relevantData));

    try {
      const files = await fs.readdir(packagePath);
      // Configuration files that influence the compilation process
      const configFiles = files
        .filter(
          f =>
            (f.startsWith('tsconfig') && f.endsWith('.json')) ||
            f === '.swcrc' ||
            f.startsWith('vite.config') ||
            f.startsWith('webpack.config') ||
            f.startsWith('rollup.config') ||
            f.startsWith('babel.config') ||
            f.startsWith('vue.config')
        )
        .sort(); // Sorted to guarantee the same hash

      for (const file of configFiles) {
        const filePath = path.join(packagePath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          hasher.update(`|${file}|${content}`);
        } catch {
          // Silently ignore if a file cannot be read
        }
      }
    } catch {
      // Ignore if the directory cannot be read for some reason
    }

    return hasher.digest('hex');
  }

  /**
   * Ensures the cache directory exists and loads the file into memory.
   */
  private async loadCache(): Promise<CacheStore> {
    if (this.memoryCache) return this.memoryCache;

    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      this.memoryCache = JSON.parse(data);
    } catch (error: any) {
      // If the file does not exist or there is a parsing error, initialize as empty
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        this.memoryCache = {};
      } else {
        throw error;
      }
    }

    return this.memoryCache!;
  }

  /**
   * Saves the current state of the cache to disk.
   */
  private async saveCache(): Promise<void> {
    if (!this.memoryCache) return;

    await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    await fs.writeFile(
      this.cacheFilePath,
      JSON.stringify(this.memoryCache, null, 2),
      'utf-8'
    );
  }

  /**
   * Tries to retrieve the cached result for a package.
   * If the current hash does not match, returns null (invalidates the cache).
   */
  public async get(
    packagePath: string,
    packageJson: any
  ): Promise<ScriptAnalysisResult | null> {
    const cache = await this.loadCache();
    const entry = cache[packagePath];

    if (!entry) return null;

    const currentHash = await this.generateHash(packagePath, packageJson);

    if (entry.hash === currentHash) {
      return entry.result;
    }

    // The hash has changed, therefore the cache is obsolete
    return null;
  }

  /**
   * Saves a new result to the cache.
   */
  public async set(
    packagePath: string,
    packageJson: any,
    result: ScriptAnalysisResult
  ): Promise<void> {
    const cache = await this.loadCache();
    const hash = await this.generateHash(packagePath, packageJson);

    cache[packagePath] = {
      hash,
      result,
    };

    await this.saveCache();
  }
}

// Export a singleton for convenience
export const scriptCache = new ScriptCache();
