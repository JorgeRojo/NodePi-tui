import fs from 'fs/promises';
import path from 'path';

import type { CustomScript, NodePiConfig } from './types.js';

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
  const defaultTemplate: NodePiConfig = { containers: [], customScripts: [] };

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return defaultTemplate;
    }

    const { containers, dependencies, customScripts } = parsed as Record<
      string,
      unknown
    >;

    if (!Array.isArray(containers)) {
      return defaultTemplate;
    }

    const validContainers = containers.filter(
      (c): c is string => typeof c === 'string'
    );

    const validDependencies =
      dependencies && typeof dependencies === 'object'
        ? (dependencies as NodePiConfig['dependencies'])
        : undefined;

    const validCustomScripts = Array.isArray(customScripts)
      ? customScripts.filter(
          (s: unknown): s is CustomScript =>
            typeof s === 'object' &&
            s !== null &&
            'type' in s &&
            typeof (s as Record<string, unknown>).type === 'string' &&
            'name' in s &&
            typeof (s as Record<string, unknown>).name === 'string' &&
            'command' in s &&
            typeof (s as Record<string, unknown>).command === 'string'
        )
      : [];

    return {
      containers: validContainers,
      dependencies: validDependencies,
      customScripts: validCustomScripts,
    };
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
