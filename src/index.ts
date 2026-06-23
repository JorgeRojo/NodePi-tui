#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { runWizard } from './wizard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
);

const usage = `NodePi CLI Wizard

Usage:
  nodepi [options]

Options:
  -c, --cwd <path>      Set the current working directory to run the wizard in.
  -v, --version         Print version and exit.
  -h, --help            Print help usage and exit.
`;

const { values } = parseArgs({
  options: {
    cwd: {
      type: 'string',
      short: 'c',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
    version: {
      type: 'boolean',
      short: 'v',
    },
  },
  strict: false,
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

if (values.version) {
  console.log(`nodepi v${pkg.version}`);
  process.exit(0);
}

if (values.cwd && typeof values.cwd === 'string') {
  const targetDir = path.resolve(values.cwd);
  try {
    process.chdir(targetDir);
  } catch (err: any) {
    console.error(
      `Error: Could not change directory to ${targetDir}: ${err.message}`
    );
    process.exit(1);
  }
}

runWizard().catch(err => {
  console.error('Uncaught fatal error:', err.message);
  process.exit(1);
});
