import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { main, usage } from '../index.js';
import { runWizard } from '../wizard.js';

vi.mock('../wizard.js', () => ({
  runWizard: vi.fn().mockResolvedValue(undefined),
}));

describe('CLI Entrypoint (index.ts)', () => {
  let exitSpy: any;
  let chdirSpy: any;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    chdirSpy = vi.spyOn(process, 'chdir').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    exitSpy.mockRestore();
    chdirSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('should display help and exit with 0', async () => {
    await main(['--help']);
    expect(logSpy).toHaveBeenCalledWith(usage);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('should display version and exit with 0', async () => {
    await main(['-v']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('nodepi v'));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('should change working directory if valid cwd is provided', async () => {
    await main(['--cwd', '/some/valid/path']);
    expect(chdirSpy).toHaveBeenCalledWith(
      expect.stringContaining('/some/valid/path')
    );
    expect(runWizard).toHaveBeenCalled();
  });

  test('should log error and exit with 1 if changing directory fails', async () => {
    chdirSpy.mockImplementation(() => {
      throw new Error('Directory not found');
    });

    await main(['--cwd', '/invalid/path']);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not change directory to')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runWizard).not.toHaveBeenCalled();
  });

  test('should run wizard successfully by default', async () => {
    await main([]);
    expect(runWizard).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
