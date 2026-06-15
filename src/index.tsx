#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { restoreTargetSync } from './core/backupManager.js';
import { processManager } from './core/execution/ProcessManager.js';
import { logger } from './core/logger.js';
import { runPreflightValidations } from './core/validators/index.js';
import { processStore } from './store/processStore.js';
import { App } from './ui/App.js';

const { values } = parseArgs({
  options: {
    cwd: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  strict: false,
});

if (values.version) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  logger.log(`NodePi-tui v${pkg.version}`);
  process.exit(0);
}

if (values.help) {
  logger.log(`
NodePi-tui - Orchestrator for Vite projects

Usage:
  nodepi [options]

Options:
  --cwd <path>      Specify the target project directory (default: current directory)
  -v, --version     Output the version number
  -h, --help        Show this help message
`);
  process.exit(0);
}

if (typeof values.cwd === 'string') {
  try {
    process.chdir(path.resolve(values.cwd));
  } catch {
    logger.error(`Cannot access target directory '${values.cwd}'.`);
    process.exit(1);
  }
}

function handleExit(code: number): never {
  try {
    const processes = processStore.getState().processes;
    Object.values(processes).forEach(proc => {
      if (proc.status === 'running') {
        processManager.killProcess(proc.pid);
      }
    });
    restoreTargetSync(process.cwd());
  } catch (err) {
    logger.error('Failed to restore backup synchronously: ' + String(err));
  }
  process.exit(code);
}

process.on('SIGINT', () => handleExit(0));
process.on('SIGTERM', () => handleExit(0));
process.on('uncaughtException', err => {
  logger.error(
    'Uncaught Exception: ' +
      (err instanceof Error ? err.stack || err.message : String(err))
  );
  handleExit(1);
});

async function bootstrap(): Promise<void> {
  try {
    await runPreflightValidations();
    render(<App />);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(String(error));
    }
    process.exit(1);
  }
}

bootstrap();
