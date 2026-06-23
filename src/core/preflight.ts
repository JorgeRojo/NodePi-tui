import { confirm, log, spinner } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

import { backupRestoreManager } from './backup-restore.js';

export interface PreflightResult {
  isViteProject: boolean;
  viteConfigPath: string | null;
  hasAgy: boolean;
}

/**
 * Checks if a CLI command is available in the user's system PATH.
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execa('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs all system preflight checks and returns project characteristics.
 */
export async function runPreflight(): Promise<PreflightResult> {
  // 1. Post-Crash Recovery Check
  if (backupRestoreManager.hasBackup()) {
    log.warn(
      pc.yellow(
        '⚠️  NodePi has detected an unexpected shutdown from a previous execution.'
      )
    );

    const shouldRestore = await confirm({
      message:
        'Do you want to restore the target project files to their original state?',
      initialValue: true,
    });

    if (typeof shouldRestore === 'symbol') {
      log.error('Operation cancelled.');
      process.exit(1);
      return undefined as any;
    }

    if (shouldRestore) {
      const s = spinner();
      s.start('Restoring backups...');
      try {
        backupRestoreManager.restore();
        s.stop(
          pc.green('Environment successfully restored to its original state!')
        );
      } catch (err: any) {
        s.stop(pc.red(`Failed to restore: ${err.message}`));
        process.exit(1);
        return undefined as any;
      }
    } else {
      log.warn(
        pc.yellow(
          'Restore skipped. The project might be in an inconsistent state.'
        )
      );
    }
  }

  // 2. System Tools Validation
  const targetDir = process.cwd();
  const s = spinner();
  s.start('Validating system requirements...');

  const hasRsync = await commandExists('rsync');
  const hasGit = await commandExists('git');
  const hasAgy = await commandExists('agy');

  if (!hasRsync || !hasGit) {
    s.stop(pc.red('Failed to validate system requirements.'));

    const missing = [];
    if (!hasRsync) missing.push('rsync');
    if (!hasGit) missing.push('git');

    log.error(
      pc.red(
        `Error: The following required tools are missing: ${missing.join(', ')}`
      )
    );
    log.message(
      pc.dim('Please install these tools on your system before continuing.')
    );
    process.exit(1);
    return undefined as any;
  }

  // 3. Vite Detection
  const viteFiles = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
    'vite.config.mts',
    'vite.config.mts',
  ];

  let viteConfigPath: string | null = null;
  let isViteProject = false;

  for (const file of viteFiles) {
    const filePath = path.join(targetDir, file);
    if (fs.existsSync(filePath)) {
      viteConfigPath = filePath;
      isViteProject = true;
      break;
    }
  }

  // Create summary log strings
  const rsyncStatus = pc.green('[✓] rsync detected');
  const gitStatus = pc.green('[✓] git detected');
  const agyStatus = hasAgy
    ? pc.green('[✓] agy detected (AI inference enabled)')
    : pc.yellow(
        '[!] agy NOT detected (manual interactive fallback will be used)'
      );
  const viteStatus = isViteProject
    ? pc.green(
        '[✓] Vite configuration detected (Vite HMR integrations enabled)'
      )
    : pc.yellow(
        '[!] Vite configuration NOT detected (Vite wrappers will be skipped)'
      );

  s.stop(pc.green('System requirements validated!'));

  // Show detailed checklist
  console.log(
    pc.dim(
      `  ${rsyncStatus}\n  ${gitStatus}\n  ${agyStatus}\n  ${viteStatus}\n`
    )
  );

  return {
    isViteProject,
    viteConfigPath,
    hasAgy,
  };
}
