import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateConfig } from '../configValidator.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import chalk from 'chalk';

vi.mock('fs/promises');
vi.mock('os');

describe('validateConfig', () => {
  const mockHomeDir = '/Users/mockuser';
  const mockConfigPath = path.join(mockHomeDir, '.nodepirc.json');

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws if config file does not exist', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Global configuration missing: ${mockConfigPath}`)
    );
  });

  it('throws if file read fails', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES'));

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Failed to read configuration: ${mockConfigPath}`)
    );
  });

  it('throws if JSON is invalid', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('invalid-json');

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Invalid JSON format in ${mockConfigPath}`)
    );
  });

  it('throws if config is not an object', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('null');

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Invalid configuration structure in ${mockConfigPath}`)
    );
  });

  it('throws if containers is missing or not an array', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Configuration must contain a non-empty 'containers' array`)
    );
  });

  it('throws if containers array is empty', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ containers: [] }));

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Configuration must contain a non-empty 'containers' array`)
    );
  });

  it('throws if container path is not a string', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ containers: [123] }));

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Container paths must be strings`)
    );
  });

  it('throws if container path does not resolve under home directory', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ containers: ['/var/www/html'] }));

    await expect(validateConfig()).rejects.toThrowError(
      chalk.red(`Container path must resolve under home directory (~/): /var/www/html`)
    );
  });

  it('resolves successfully for valid configuration with absolute path', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ containers: [`${mockHomeDir}/projects/app`] }));

    await expect(validateConfig()).resolves.toBeUndefined();
  });

  it('resolves successfully for valid configuration with ~ path', async () => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ containers: ['~/projects/app'] }));

    await expect(validateConfig()).resolves.toBeUndefined();
  });
});
