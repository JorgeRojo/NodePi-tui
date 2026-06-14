import { describe, it, expect, vi, afterEach } from 'vitest';
import { execa } from 'execa';
import chalk from 'chalk';
import { validateSystem } from '../systemValidator.js';

vi.mock('execa');

describe('validateSystem', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve successfully if all system tools are present', async () => {
    vi.mocked(execa).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof execa>>);

    await expect(validateSystem()).resolves.toBeUndefined();
    
    expect(vi.mocked(execa)).toHaveBeenCalledWith('pnpm', ['--version']);
    expect(vi.mocked(execa)).toHaveBeenCalledWith('rsync', ['--version']);
    expect(vi.mocked(execa)).toHaveBeenCalledWith('git', ['--version']);
    expect(vi.mocked(execa)).toHaveBeenCalledTimes(3);
  });

  it('should throw an error if a system tool is missing', async () => {
    vi.mocked(execa).mockImplementation(((file: string) => {
      if (file === 'rsync') {
        return Promise.reject(new Error('Command failed with ENOENT: rsync'));
      }
      return Promise.resolve({} as unknown as Awaited<ReturnType<typeof execa>>);
    }) as unknown as typeof execa);

    await expect(validateSystem()).rejects.toThrow(
      chalk.red('System dependency missing: rsync')
    );
  });
});
