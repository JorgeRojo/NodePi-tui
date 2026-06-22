import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface LocalDependency {
  name: string;
  sourcePath: string;
}

export interface NodePiConfig {
  mode: 'sync' | 'inject';
  dependencies: LocalDependency[];
}

export interface NodePiGlobalConfig {
  containers: string[];
}

export class ConfigManager {
  private configFilePath: string;
  private homedirPath: string;

  constructor(cwd: string = process.cwd(), homedir: string = os.homedir()) {
    this.configFilePath = path.join(cwd, '.nodepirc.json');
    this.homedirPath = homedir;
  }

  /**
   * Loads the local configuration from .nodepirc.json.
   * If the file does not exist, returns the default configuration.
   */
  public async load(): Promise<NodePiConfig> {
    const defaultConfig: NodePiConfig = {
      mode: 'inject',
      dependencies: [],
    };

    try {
      const data = await fs.readFile(this.configFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      // Basic validation
      return {
        mode: parsed.mode === 'sync' ? 'sync' : 'inject',
        dependencies: Array.isArray(parsed.dependencies)
          ? parsed.dependencies
          : [],
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return defaultConfig;
      }
      // If JSON is invalid, return default config
      return defaultConfig;
    }
  }

  /**
   * Loads the global configuration from ~/.nodepirc.json.
   * If the file does not exist, returns the default configuration.
   */
  public async loadGlobal(): Promise<NodePiGlobalConfig> {
    const defaultGlobalConfig: NodePiGlobalConfig = {
      containers: [],
    };

    const globalPath = path.join(this.homedirPath, '.nodepirc.json');

    try {
      const data = await fs.readFile(globalPath, 'utf-8');
      const parsed = JSON.parse(data);
      const containers = Array.isArray(parsed.containers)
        ? parsed.containers
        : [];

      const resolvedContainers = containers.map((dir: string) => {
        if (dir.startsWith('~/') || dir === '~') {
          return path.join(this.homedirPath, dir.slice(1));
        }
        return path.resolve(dir);
      });

      return {
        containers: resolvedContainers,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return defaultGlobalConfig;
      }
      return defaultGlobalConfig;
    }
  }

  /**
   * Saves the configuration to .nodepirc.json.
   */
  public async save(config: NodePiConfig): Promise<void> {
    await fs.writeFile(
      this.configFilePath,
      JSON.stringify(config, null, 2),
      'utf-8'
    );
  }

  /**
   * Saves the global configuration to ~/.nodepirc.json.
   */
  public async saveGlobal(config: NodePiGlobalConfig): Promise<void> {
    const globalPath = path.join(this.homedirPath, '.nodepirc.json');
    await fs.writeFile(globalPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}

export const configManager = new ConfigManager();
