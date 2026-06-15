import chalk from 'chalk';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const validateConfig = async (): Promise<void> => {
  const homeDir = os.homedir();
  const configPath = path.join(homeDir, '.nodepirc.json');

  try {
    await fs.access(configPath);
  } catch {
    throw new Error(chalk.red(`Global configuration missing: ${configPath}`));
  }

  let fileContent: string;
  try {
    fileContent = await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    throw new Error(chalk.red(`Failed to read configuration: ${configPath}`), {
      cause: error,
    });
  }

  let config: unknown;
  try {
    config = JSON.parse(fileContent);
  } catch {
    throw new Error(chalk.red(`Invalid JSON format in ${configPath}`));
  }

  if (!config || typeof config !== 'object') {
    throw new Error(
      chalk.red(`Invalid configuration structure in ${configPath}`)
    );
  }

  const { containers } = config as { containers?: unknown };

  if (!Array.isArray(containers) || containers.length === 0) {
    throw new Error(
      chalk.red(`Configuration must contain a non-empty 'containers' array`)
    );
  }

  for (const containerPath of containers) {
    if (typeof containerPath !== 'string') {
      throw new Error(chalk.red(`Container paths must be strings`));
    }

    // Resolve ~ to home dir
    const resolvedPath = containerPath.startsWith('~/')
      ? path.join(homeDir, containerPath.slice(2))
      : path.resolve(containerPath);

    if (!resolvedPath.startsWith(homeDir)) {
      throw new Error(
        chalk.red(
          `Container path must resolve under home directory (~/): ${containerPath}`
        )
      );
    }
  }

  const { customScripts } = config as { customScripts?: unknown };

  if (customScripts !== undefined) {
    if (!Array.isArray(customScripts)) {
      throw new Error(
        chalk.red(`'customScripts' must be an array if provided`)
      );
    }

    for (const script of customScripts) {
      if (!script || typeof script !== 'object') {
        throw new Error(chalk.red(`Each custom script must be an object`));
      }

      const s = script as Record<string, unknown>;
      if (
        typeof s.type !== 'string' ||
        typeof s.name !== 'string' ||
        typeof s.command !== 'string'
      ) {
        throw new Error(
          chalk.red(
            `Custom script must contain 'type', 'name', and 'command' as strings`
          )
        );
      }
    }
  }
};
