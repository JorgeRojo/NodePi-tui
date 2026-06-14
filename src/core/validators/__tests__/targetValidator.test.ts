import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { validateTarget } from '../targetValidator.js';
import chalk from 'chalk';
import path from 'path';

vi.mock('fs/promises');

describe('validateTarget', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve if package.json and a vite config are present', async () => {
    // Mock fs.access to resolve for all files
    vi.mocked(fs.access).mockResolvedValue(undefined);

    await expect(validateTarget()).resolves.toBeUndefined();
    // It should check package.json and then vite.config.ts or vite.config.js
    expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), 'package.json'));
  });

  it('should throw an error if package.json is missing', async () => {
    // Rejects on the first call (package.json)
    vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

    await expect(validateTarget()).rejects.toThrow(chalk.red('Not a valid Vite project.'));
  });

  it('should throw an error if vite config is missing', async () => {
    // Resolves for package.json, rejects for both vite.config.ts and vite.config.js
    vi.mocked(fs.access)
      .mockResolvedValueOnce(undefined) // package.json
      .mockRejectedValueOnce(new Error('ENOENT')) // vite.config.ts
      .mockRejectedValueOnce(new Error('ENOENT')); // vite.config.js

    await expect(validateTarget()).rejects.toThrow(chalk.red('Not a valid Vite project.'));
  });

  it('should resolve if package.json and vite.config.js are present but vite.config.ts is missing', async () => {
    vi.mocked(fs.access)
      .mockResolvedValueOnce(undefined) // package.json
      .mockRejectedValueOnce(new Error('ENOENT')) // vite.config.ts missing
      .mockResolvedValueOnce(undefined); // vite.config.js present

    await expect(validateTarget()).resolves.toBeUndefined();
  });
});
