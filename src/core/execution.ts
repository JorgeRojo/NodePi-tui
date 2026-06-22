import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Runs rsync from source to destination, excluding node_modules, .git, and .nodepi.
 */
export async function runRsync(
  source: string,
  destination: string
): Promise<void> {
  const srcPath = source.endsWith('/') ? source : `${source}/`;
  const destPath = destination.endsWith('/') ? destination : `${destination}/`;

  await execa('rsync', [
    '-ax',
    '--delete',
    '--exclude',
    'node_modules',
    '--exclude',
    '.git',
    '--exclude',
    '.nodepi',
    srcPath,
    destPath,
  ]);
}

/**
 * Patches the "main" entrypoint in the target node_modules copy of the dependency if it is empty.
 * Returns true if the package.json was successfully patched, false otherwise.
 */
export async function patchEntrypoint(
  destPkgDir: string,
  outDir: string
): Promise<boolean> {
  const pkgJsonPath = path.join(destPkgDir, 'package.json');
  let content: string;
  try {
    content = await fs.readFile(pkgJsonPath, 'utf-8');
  } catch {
    return false; // No package.json to patch
  }

  const pkg = JSON.parse(content);
  const mainField = pkg.main ? String(pkg.main).trim() : '';

  // Check if main points to a valid file
  let mainExists = false;
  if (mainField) {
    try {
      await fs.access(path.join(destPkgDir, mainField));
      mainExists = true;
    } catch {
      mainExists = false;
    }
  }

  // If main doesn't exist or is empty, check if index.js exists in the outDir
  if (!mainExists) {
    const candidatePath = path.join(outDir, 'index.js');
    try {
      await fs.access(path.join(destPkgDir, candidatePath));

      // Patch package.json main field
      pkg.main = candidatePath;
      await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2), 'utf-8');
      return true;
    } catch {
      // index.js in outDir does not exist either, cannot patch
      return false;
    }
  }

  return false;
}

/**
 * Creates a backup of the original Vite config and writes a wrapper configuration
 * that forces Vite HMR to watch the local node_modules dependencies.
 */
export async function writeViteWrapper(
  targetDir: string,
  viteConfigPath: string,
  localDeps: string[]
): Promise<void> {
  const filename = path.basename(viteConfigPath);
  const backupName = filename.replace(/\.(ts|js|mjs|cjs)$/, '.backup.$1');
  const backupPath = path.join(targetDir, backupName);

  // Backup original config
  await fs.rename(viteConfigPath, backupPath);

  // Prepare exclude and watch lists for JavaScript strings
  const excludeArrayStr = localDeps.map(d => `'${d}'`).join(', ');
  const unignoreArrayStr = localDeps
    .map(d => `'!**/node_modules/${d}/**'`)
    .join(', ');

  const wrapperContent = `import originalConfig from './${backupName}';

export default async (env) => {
  const config = await (typeof originalConfig === 'function' ? originalConfig(env) : originalConfig);
  
  config.optimizeDeps = config.optimizeDeps || {};
  config.optimizeDeps.exclude = config.optimizeDeps.exclude || [];
  const depsToExclude = [${excludeArrayStr}];
  for (const dep of depsToExclude) {
    if (!config.optimizeDeps.exclude.includes(dep)) {
      config.optimizeDeps.exclude.push(dep);
    }
  }
  
  config.server = config.server || {};
  config.server.watch = config.server.watch || {};
  let ignored = config.server.watch.ignored;
  if (!ignored) {
    ignored = [];
  } else if (!Array.isArray(ignored)) {
    ignored = [ignored];
  }
  
  const unignores = [${unignoreArrayStr}];
  config.server.watch.ignored = [...ignored, ...unignores];
  
  return config;
};
`;

  await fs.writeFile(viteConfigPath, wrapperContent, 'utf-8');
}

/**
 * Restores the original Vite config from the backup file, if it exists.
 */
export async function restoreViteWrapper(
  viteConfigPath: string
): Promise<void> {
  const filename = path.basename(viteConfigPath);
  const backupName = filename.replace(/\.(ts|js|mjs|cjs)$/, '.backup.$1');
  const backupPath = path.join(path.dirname(viteConfigPath), backupName);

  try {
    await fs.access(backupPath);
    // Delete wrapper config
    await fs.unlink(viteConfigPath);
    // Restore original config
    await fs.rename(backupPath, viteConfigPath);
  } catch {
    // Backup does not exist, nothing to restore
  }
}
