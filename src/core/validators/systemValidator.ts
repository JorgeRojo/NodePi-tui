import { execa } from 'execa';
import chalk from 'chalk';

export const validateSystem = async (): Promise<void> => {
  const tools = ['pnpm', 'rsync', 'git'];

  for (const tool of tools) {
    try {
      await execa(tool, ['--version']);
    } catch {
      throw new Error(chalk.red(`System dependency missing: ${tool}`));
    }
  }
};
