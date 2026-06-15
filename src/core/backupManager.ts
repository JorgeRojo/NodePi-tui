import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const BACKUP_DIR_NAME = '.nodepi-backup';

export const backupTarget = async (
  cwd: string,
  deps: string[]
): Promise<void> => {
  const backupDir = path.join(cwd, BACKUP_DIR_NAME);

  // Clean up any existing backup
  await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(backupDir, { recursive: true }).catch(() => {});

  const filesToBackup = ['package.json', 'pnpm-lock.yaml'];

  for (const file of filesToBackup) {
    const srcPath = path.join(cwd, file);
    const destPath = path.join(backupDir, file);
    try {
      await fs.cp(srcPath, destPath, { recursive: true, force: true });
    } catch {
      // Ignore if file doesn't exist
    }
  }

  const nodeModulesDir = path.join(cwd, 'node_modules');
  const backupNodeModulesDir = path.join(backupDir, 'node_modules');

  for (const dep of deps) {
    const srcPath = path.join(nodeModulesDir, dep);
    const destPath = path.join(backupNodeModulesDir, dep);
    try {
      await fs.cp(srcPath, destPath, { recursive: true, force: true });
    } catch {
      // Ignore if dep doesn't exist in node_modules yet
    }
  }
};

export const restoreTargetSync = (cwd: string): void => {
  const backupDir = path.join(cwd, BACKUP_DIR_NAME);

  try {
    const stats = fsSync.statSync(backupDir);
    if (!stats.isDirectory()) return;
  } catch {
    // Backup dir doesn't exist
    return;
  }

  // Restore package.json and pnpm-lock.yaml
  const filesToRestore = ['package.json', 'pnpm-lock.yaml'];
  for (const file of filesToRestore) {
    const srcPath = path.join(backupDir, file);
    const destPath = path.join(cwd, file);
    try {
      fsSync.cpSync(srcPath, destPath, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }

  // Restore node_modules/<deps>
  const backupNodeModulesDir = path.join(backupDir, 'node_modules');
  try {
    const deps = fsSync.readdirSync(backupNodeModulesDir);
    const nodeModulesDir = path.join(cwd, 'node_modules');
    for (const dep of deps) {
      const srcPath = path.join(backupNodeModulesDir, dep);
      const destPath = path.join(nodeModulesDir, dep);
      try {
        fsSync.cpSync(srcPath, destPath, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
    }
  } catch {
    // Ignore if backup node_modules doesn't exist
  }

  // Remove .vite.config.nodepi.ts
  const viteConfigPath = path.join(cwd, '.vite.config.nodepi.ts');
  try {
    fsSync.rmSync(viteConfigPath, { force: true });
  } catch {
    // Ignore errors
  }
};
