import fs from 'fs/promises';
import path from 'path';

import type { NodePiConfig } from './types.js';

const CONFIG_FILENAME = '.nodepirc.json';

export const writeConfig = async (
  basePath: string,
  config: NodePiConfig
): Promise<void> => {
  const configPath = path.join(basePath, CONFIG_FILENAME);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
};

export const readConfig = async (basePath: string): Promise<NodePiConfig> => {
  const configPath = path.join(basePath, CONFIG_FILENAME);
  const defaultTemplate: NodePiConfig = { containers: [] };

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return defaultTemplate;
    }

    const { containers } = parsed as Record<string, unknown>;

    if (!Array.isArray(containers)) {
      return defaultTemplate;
    }

    const validContainers = containers.filter(
      (c): c is string => typeof c === 'string'
    );
    return { containers: validContainers };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      await writeConfig(basePath, defaultTemplate);
    }
    return defaultTemplate;
  }
};
