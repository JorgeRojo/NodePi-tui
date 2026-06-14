import { describe, it, expect, vi, afterEach } from 'vitest';
import { runPreflightValidations } from '../index.js';
import { validateSystem } from '../systemValidator.js';
import { validateConfig } from '../configValidator.js';
import { validateTarget } from '../targetValidator.js';

vi.mock('../systemValidator.js', () => ({
  validateSystem: vi.fn(),
}));

vi.mock('../configValidator.js', () => ({
  validateConfig: vi.fn(),
}));

vi.mock('../targetValidator.js', () => ({
  validateTarget: vi.fn(),
}));

describe('runPreflightValidations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call all validators successfully', async () => {
    await runPreflightValidations();

    expect(validateSystem).toHaveBeenCalledTimes(1);
    expect(validateConfig).toHaveBeenCalledTimes(1);
    expect(validateTarget).toHaveBeenCalledTimes(1);
  });

  it('should throw and stop execution if validateSystem fails', async () => {
    const error = new Error('System validation failed');
    vi.mocked(validateSystem).mockRejectedValueOnce(error);

    await expect(runPreflightValidations()).rejects.toThrow('System validation failed');

    expect(validateSystem).toHaveBeenCalledTimes(1);
    expect(validateConfig).not.toHaveBeenCalled();
    expect(validateTarget).not.toHaveBeenCalled();
  });

  it('should throw and stop execution if validateConfig fails', async () => {
    const error = new Error('Config validation failed');
    vi.mocked(validateConfig).mockRejectedValueOnce(error);

    await expect(runPreflightValidations()).rejects.toThrow('Config validation failed');

    expect(validateSystem).toHaveBeenCalledTimes(1);
    expect(validateConfig).toHaveBeenCalledTimes(1);
    expect(validateTarget).not.toHaveBeenCalled();
  });

  it('should throw if validateTarget fails', async () => {
    const error = new Error('Target validation failed');
    vi.mocked(validateTarget).mockRejectedValueOnce(error);

    await expect(runPreflightValidations()).rejects.toThrow('Target validation failed');

    expect(validateSystem).toHaveBeenCalledTimes(1);
    expect(validateConfig).toHaveBeenCalledTimes(1);
    expect(validateTarget).toHaveBeenCalledTimes(1);
  });
});
