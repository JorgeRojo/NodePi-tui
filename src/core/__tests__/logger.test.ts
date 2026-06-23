import { afterEach, beforeEach, describe, expect, test } from 'vitest';
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
});
