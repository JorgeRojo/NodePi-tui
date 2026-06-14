import { afterEach, describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';

import { inferScripts } from '../inference.js';

vi.mock('execa');

describe('inferScripts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockPackageJson = JSON.stringify({
    name: 'test-app',
    scripts: {
      start: 'node index.js',
      build: 'tsc',
    },
  });

  it('should resolve and parse successfully when Agy returns a valid JSON', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"dev": "npm start", "build": "npm run build", "watch": null}',
    } as unknown as Awaited<ReturnType<typeof execa>>);

    const result = await inferScripts(mockPackageJson);

    expect(result).toEqual({
      dev: 'npm start',
      build: 'npm run build',
      watch: null,
    });

    expect(vi.mocked(execa)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(execa).mock.calls[0]?.[0]).toBe('agy');
    expect(vi.mocked(execa).mock.calls[0]?.[1]).toContain('--model');
    expect(vi.mocked(execa).mock.calls[0]?.[1]).toContain('gemini-1.5-flash');
    expect(vi.mocked(execa).mock.calls[0]?.[1]).toContain('--print');
  });

  it('should throw an error if Agy returns invalid JSON', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: 'This is not JSON',
    } as unknown as Awaited<ReturnType<typeof execa>>);

    await expect(inferScripts(mockPackageJson)).rejects.toThrow(
      'Failed to parse Agy output as JSON'
    );
  });

  it('should throw an error if Agy returns JSON with incorrect shape (missing keys)', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"dev": "npm start", "build": "npm run build"}',
    } as unknown as Awaited<ReturnType<typeof execa>>);

    await expect(inferScripts(mockPackageJson)).rejects.toThrow(
      'Invalid JSON shape returned by Agy'
    );
  });

  it('should throw an error if Agy returns JSON with incorrect value types', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: '{"dev": "npm start", "build": 123, "watch": null}',
    } as unknown as Awaited<ReturnType<typeof execa>>);

    await expect(inferScripts(mockPackageJson)).rejects.toThrow(
      'Invalid JSON shape returned by Agy'
    );
  });

  it('should propagate execa errors', async () => {
    vi.mocked(execa).mockRejectedValue(new Error('execa failed'));

    await expect(inferScripts(mockPackageJson)).rejects.toThrow('execa failed');
  });
});
