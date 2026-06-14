/* eslint-disable no-console */
import chalk from 'chalk';

export const logger = {
  info: (message: string): void => console.log(chalk.blue('ℹ'), message),
  success: (message: string): void => console.log(chalk.green('✔'), message),
  warn: (message: string): void => console.warn(chalk.yellow('⚠'), message),
  error: (message: string): void => console.error(chalk.red('✖'), message),
  fatal: (message: string): never => {
    console.error(chalk.red.bold('✖ FATAL:'), message);
    process.exit(1);
  },
  // Plain text for when we don't want prefixes
  log: (message: string): void => console.log(message),
};
