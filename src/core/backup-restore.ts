import fs from 'node:fs';
import path from 'node:path';

export interface BackupDependency {
  name: string;
  originalPath: string; // e.g., "node_modules/lib-core"
  backupPath: string; // e.g., ".nodepi/backups/node_modules/lib-core"
  originalExists: boolean;
}

export interface BackupMetadata {
  viteConfigPath: string | null;
  viteConfigBackedUp: boolean;
  dependencies: BackupDependency[];
}

export class BackupRestoreManager {
  private nodepiDir = path.join(process.cwd(), '.nodepi');
  private backupDir = path.join(process.cwd(), '.nodepi', 'backups');
  private metaPath = path.join(process.cwd(), '.nodepi', 'backup-meta.json');

  /**
   * Checks if an unclean exit backup metadata file exists.
   */
  public hasBackup(): boolean {
    return fs.existsSync(this.metaPath);
  }

  /**
   * Loads the backup metadata.
   */
  public loadMetadata(): BackupMetadata | null {
    if (!this.hasBackup()) return null;
    try {
      const content = fs.readFileSync(this.metaPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading backup metadata:', error);
      return null;
    }
  }

  /**
   * Saves the backup metadata.
   */
  private saveMetadata(meta: BackupMetadata): void {
    fs.mkdirSync(this.nodepiDir, { recursive: true });
    fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * Backs up the target project environment for specified dependencies.
   */
  public backup(dependencies: string[], viteConfigPath: string | null): void {
    // 1. Create backup directories
    fs.mkdirSync(this.backupDir, { recursive: true });

    const meta: BackupMetadata = {
      viteConfigPath: null,
      viteConfigBackedUp: false,
      dependencies: [],
    };

    // 2. Backup Vite configuration if present
    if (viteConfigPath && fs.existsSync(viteConfigPath)) {
      const filename = path.basename(viteConfigPath);
      const dest = path.join(this.backupDir, `${filename}.backup`);
      fs.copyFileSync(viteConfigPath, dest);
      meta.viteConfigPath = viteConfigPath;
      meta.viteConfigBackedUp = true;
    }

    // 3. Backup dependency folders inside node_modules
    const nodeModulesDir = path.join(process.cwd(), 'node_modules');
    for (const depName of dependencies) {
      const depPath = path.join(nodeModulesDir, depName);
      const depBackupPath = path.join(this.backupDir, 'node_modules', depName);

      const depExists = fs.existsSync(depPath);
      if (depExists) {
        fs.mkdirSync(path.join(this.backupDir, 'node_modules'), {
          recursive: true,
        });

        // Handle scoped packages (e.g., @myorg/lib)
        if (depName.startsWith('@')) {
          const scopeDir = path.dirname(depBackupPath);
          fs.mkdirSync(scopeDir, { recursive: true });
        }

        // Move the directory synchronously
        try {
          fs.renameSync(depPath, depBackupPath);
        } catch (err: any) {
          if (err.code === 'EXDEV') {
            fs.cpSync(depPath, depBackupPath, { recursive: true });
            fs.rmSync(depPath, { recursive: true, force: true });
          } else {
            throw err;
          }
        }
      }

      meta.dependencies.push({
        name: depName,
        originalPath: path.relative(process.cwd(), depPath),
        backupPath: path.relative(process.cwd(), depBackupPath),
        originalExists: depExists,
      });
    }

    // 4. Save metadata
    this.saveMetadata(meta);
  }

  /**
   * Restores the target project back to its original state using the metadata.
   */
  public restore(): void {
    const meta = this.loadMetadata();
    if (!meta) return;

    // 1. Restore Vite configuration
    if (meta.viteConfigBackedUp && meta.viteConfigPath) {
      const filename = path.basename(meta.viteConfigPath);
      const src = path.join(this.backupDir, `${filename}.backup`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, meta.viteConfigPath);
      }

      // Clean up backup file renamed by the CLI wrapper
      const backupConfigName = filename.replace(
        /\.(ts|js|mjs|cjs)$/,
        '.backup.$1'
      );
      const backupConfigPath = path.join(process.cwd(), backupConfigName);
      if (fs.existsSync(backupConfigPath)) {
        try {
          fs.unlinkSync(backupConfigPath);
        } catch {
          // Ignore
        }
      }
    }

    // 2. Restore dependency directories inside node_modules
    for (const dep of meta.dependencies) {
      const depPath = path.join(process.cwd(), dep.originalPath);
      const depBackupPath = path.join(process.cwd(), dep.backupPath);

      // Remove whatever is currently in node_modules/dep (symlinks or folders created by pnpm)
      if (fs.existsSync(depPath)) {
        fs.rmSync(depPath, { recursive: true, force: true });
      }

      if (dep.originalExists && fs.existsSync(depBackupPath)) {
        // Handle scoped package directory structure
        if (dep.name.startsWith('@')) {
          const scopeDir = path.dirname(depPath);
          fs.mkdirSync(scopeDir, { recursive: true });
        }

        // Move backup back to original location
        try {
          fs.renameSync(depBackupPath, depPath);
        } catch (err: any) {
          if (err.code === 'EXDEV') {
            fs.cpSync(depBackupPath, depPath, { recursive: true });
            fs.rmSync(depBackupPath, { recursive: true, force: true });
          } else {
            throw err;
          }
        }
      }
    }

    // 3. Clean up .nodepi folder entirely
    try {
      fs.rmSync(this.nodepiDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up .nodepi folder:', error);
    }
  }
}

export const backupRestoreManager = new BackupRestoreManager();
