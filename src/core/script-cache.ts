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
    // Sugiero guardar esto en un directorio global para compartir el cálculo entre varios proyectos
    const globalDir = path.join(os.homedir(), '.nodepi');
    this.cacheFilePath = path.join(globalDir, 'scripts_cache.json');
  }

  /**
   * Genera un hash SHA-256 a partir de los campos relevantes que definen si el build cambia.
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
      // Ficheros de configuración que influyen en el proceso de compilación
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
        .sort(); // Ordenados para garantizar el mismo hash

      for (const file of configFiles) {
        const filePath = path.join(packagePath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          hasher.update(`|${file}|${content}`);
        } catch {
          // Ignorar silenciosamente si no se puede leer un fichero
        }
      }
    } catch {
      // Ignorar si el directorio no se puede leer por alguna razón
    }

    return hasher.digest('hex');
  }

  /**
   * Asegura que el directorio de caché exista y carga el fichero a memoria.
   */
  private async loadCache(): Promise<CacheStore> {
    if (this.memoryCache) return this.memoryCache;

    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      this.memoryCache = JSON.parse(data);
    } catch (error: any) {
      // Si no existe el fichero o hay error de parseo, inicializamos vacío
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        this.memoryCache = {};
      } else {
        throw error;
      }
    }

    return this.memoryCache!;
  }

  /**
   * Guarda el estado actual de la caché en el disco.
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
   * Intenta recuperar el resultado cacheado para un paquete.
   * Si el hash actual no coincide, devuelve null (invalida la caché).
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

    // El hash ha cambiado, por lo tanto la caché está obsoleta
    return null;
  }

  /**
   * Guarda un nuevo resultado en la caché.
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

// Exportamos un singleton por comodidad
export const scriptCache = new ScriptCache();
