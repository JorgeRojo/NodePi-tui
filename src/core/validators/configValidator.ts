import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

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
    throw new Error(chalk.red(`Failed to read configuration: ${configPath}`));
  }

  let config: unknown;
  try {
    config = JSON.parse(fileContent);
  } catch {
    throw new Error(chalk.red(`Invalid JSON format in ${configPath}`));
  }

  if (!config || typeof config !== 'object') {
    throw new Error(chalk.red(`Invalid configuration structure in ${configPath}`));
  }

  const { containers } = config as { containers?: unknown };

  if (!Array.isArray(containers) || containers.length === 0) {
    throw new Error(chalk.red(`Configuration must contain a non-empty 'containers' array`));
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
      throw new Error(chalk.red(`Container path must resolve under home directory (~/): ${containerPath}`));
    }
  }
};
