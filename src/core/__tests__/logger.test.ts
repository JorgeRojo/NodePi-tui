import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { Logger } from '../logger.js';

describe('Logger Daily Rotation', () => {
  let tempDir: string;
  let logsDir: string;

  beforeEach(() => {
    tempDir = path.join(
      process.cwd(),
      'temp-logger-test-' + Math.random().toString(36).slice(2)
    );
    logsDir = path.join(tempDir, '.nodepi', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  test('should keep only the 3 most recent log files and delete older ones', () => {
    const logger = new Logger();
    // Override logDir internally for testing
    (logger as any).logDir = logsDir;

    // Create 5 mock daily log files
    const dates = [
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
      '2026-06-22',
      '2026-06-23',
    ];

    for (const d of dates) {
      fs.writeFileSync(
        path.join(logsDir, `background-${d}.log`),
        `Log for ${d}`
      );
    }

    // Verify 5 files exist initially
    let files = fs.readdirSync(logsDir);
    expect(files.length).toBe(5);

    // Trigger log rotation
    (logger as any).rotateLogs();

    // Verify only the 3 most recent files remain
    files = fs.readdirSync(logsDir);
    expect(files.length).toBe(3);

    expect(files).toContain('background-2026-06-21.log');
    expect(files).toContain('background-2026-06-22.log');
    expect(files).toContain('background-2026-06-23.log');

    expect(files).not.toContain('background-2026-06-19.log');
    expect(files).not.toContain('background-2026-06-20.log');
  });

  test('should initialize write stream, log messages, and close stream', async () => {
    const logger = new Logger();
    (logger as any).logDir = logsDir;

    logger.init();
    expect(logger.getLogFilePath()).toContain('background-');

    logger.info('TestCat', 'Test Message Info');
    logger.warn('TestCat', 'Test Message Warn');
    logger.error('TestCat', 'Test Message Error');
    logger.debug('TestCat', 'Test Message Debug');

    const stream = (logger as any).writeStream;
    expect(stream).not.toBeNull();

    // Trigger process exit event to cover the auto-close listener
    process.emit('exit', 0);

    // Wait for the stream to close
    await new Promise<void>(resolve => {
      stream.on('close', resolve);
    });

    const logContent = fs.readFileSync(logger.getLogFilePath(), 'utf-8');
    expect(logContent).toContain('[INFO] [TestCat] Test Message Info');
    expect(logContent).toContain('[WARN] [TestCat] Test Message Warn');
    expect(logContent).toContain('[ERROR] [TestCat] Test Message Error');
    expect(logContent).toContain('[DEBUG] [TestCat] Test Message Debug');
  });

  test('should fallback to appendFileSync when writeStream is closed/absent', () => {
    const logger = new Logger();
    (logger as any).logDir = logsDir;

    // Set logFilePath but no writeStream
    const testLogFile = path.join(logsDir, 'fallback-append.log');
    (logger as any).logFilePath = testLogFile;

    logger.info('FallbackCat', 'Fallback Message');

    const logContent = fs.readFileSync(testLogFile, 'utf-8');
    expect(logContent).toContain('[INFO] [FallbackCat] Fallback Message');
  });

  test('should handle appendFileSync write errors gracefully', () => {
    const logger = new Logger();
    (logger as any).logDir = logsDir;
    (logger as any).logFilePath = path.join(logsDir, 'read-only.log');

    // Mock fs.appendFileSync to throw
    const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });

    // Should not throw
    expect(() => logger.info('FailCat', 'Fail Message')).not.toThrow();

    appendSpy.mockRestore();
  });

  test('should handle init errors gracefully when folder creation throws', () => {
    const logger = new Logger();
    (logger as any).logDir = logsDir;

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => logger.init()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test('should handle rotation errors gracefully when readdirSync throws', () => {
    const logger = new Logger();
    (logger as any).logDir = logsDir;

    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('read error');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Directly test private rotateLogs method
    expect(() => (logger as any).rotateLogs()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();

    readdirSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
