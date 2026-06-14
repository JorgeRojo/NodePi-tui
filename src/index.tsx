#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { App } from './ui/App.js';

import { runPreflightValidations } from './core/validators/index.js';

const { values } = parseArgs({
  options: {
    cwd: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

if (values.help) {
  console.log(`
NodePi-tui - Orchestrator for Vite projects

Usage:
  nodepi [options]

Options:
  --cwd <path>      Specify the target project directory (default: current directory)
  -h, --help        Show this help message
`);
  process.exit(0);
}

if (typeof values.cwd === 'string') {
  try {
    process.chdir(path.resolve(values.cwd));
  } catch {
    console.error(`\n[NodePi] Error: Cannot access target directory '${values.cwd}'.`);
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    await runPreflightValidations();
    render(<App />);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

bootstrap();
