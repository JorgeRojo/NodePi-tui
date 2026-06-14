import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

export const validateTarget = async (): Promise<void> => {
  const cwd = process.cwd();

  try {
    await fs.access(path.join(cwd, 'package.json'));
  } catch {
    throw new Error(chalk.red('Not a valid Vite project.'));
  }

  try {
    await fs.access(path.join(cwd, 'vite.config.ts'));
  } catch {
    try {
      await fs.access(path.join(cwd, 'vite.config.js'));
    } catch {
      throw new Error(chalk.red('Not a valid Vite project.'));
    }
  }
};
