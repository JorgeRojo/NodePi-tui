/* eslint-disable no-console */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import chalk from 'chalk';

import { logger } from '../logger.js';

describe('Logger Utility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages with blue icon', () => {
    logger.info('test info');
    expect(console.log).toHaveBeenCalledWith(chalk.blue('ℹ'), 'test info');
  });

  it('should log success messages with green icon', () => {
    logger.success('test success');
    expect(console.log).toHaveBeenCalledWith(chalk.green('✔'), 'test success');
  });

  it('should log warn messages with yellow icon', () => {
    logger.warn('test warn');
    expect(console.warn).toHaveBeenCalledWith(chalk.yellow('⚠'), 'test warn');
  });

  it('should log error messages with red icon', () => {
    logger.error('test error');
    expect(console.error).toHaveBeenCalledWith(chalk.red('✖'), 'test error');
  });

  it('should log fatal messages, use red.bold icon, and exit process', () => {
    logger.fatal('test fatal');
    expect(console.error).toHaveBeenCalledWith(
      chalk.red.bold('✖ FATAL:'),
      'test fatal'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should log plain messages without formatting', () => {
    logger.log('test plain');
    expect(console.log).toHaveBeenCalledWith('test plain');
  });
});
