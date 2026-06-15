import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

import { useAppStore } from '../../store/appStore.js';
import { sortTopologically } from '../config-manager/sorter.js';
import type { PackageMetadata } from '../config-manager/types.js';
import { isCacheValid, updateCache } from './cache.js';
import { injectViteWrapper } from './viteWrapper.js';
import { syncWatcher } from './watcher.js';
import { processManager } from './ProcessManager.js';

export async function runPipeline(force: boolean = false): Promise<void> {
  const store = useAppStore.getState();
  if (store.pipelineStatus === 'running') {
    return;
  }

  store.setPipelineStatus('running');

  try {
    const dependencies = store.dependencies.filter(d => d.enabled);

    const pkgs: PackageMetadata[] = [];
    for (const dep of dependencies) {
      const pkgPath = path.join(dep.path, 'package.json');
      try {
        const pkgRaw = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw) as PackageMetadata;
        pkgs.push(pkg);
      } catch {
        // Skip dependencies with no package.json or invalid JSON
      }
    }

    const sortedPkgs = sortTopologically(pkgs);
    const sortedDependencies = sortedPkgs
      .map(pkg => dependencies.find(d => d.name === pkg.name))
      .filter((d): d is NonNullable<typeof d> => d !== undefined);

    // Sequential Phase
    for (const dep of sortedDependencies) {
      const cacheValid = await isCacheValid(dep.path);

      if (force || !cacheValid) {
        // Clean
        await fs
          .rm(path.join(dep.path, 'dist'), { recursive: true, force: true })
          .catch(() => {});
        await fs
          .rm(path.join(dep.path, 'build'), { recursive: true, force: true })
          .catch(() => {});

        // Install
        await execa('pnpm', ['install'], { cwd: dep.path });

        // Pre-Build
        await execa('pnpm', ['run', 'build'], { cwd: dep.path });

        await updateCache(dep.path);
      }
    }

    // Target Install
    await execa('pnpm', ['install'], { cwd: store.target.cwd });

    // Inject Phase
    const injectDeps = sortedDependencies.filter(d => d.type === 'Inject');
    if (injectDeps.length > 0) {
      await injectViteWrapper(store.target.cwd);
    }

    // Parallel Phase
    const syncDeps = sortedDependencies.filter(d => d.type === 'Sync');
    for (const dep of syncDeps) {
      const targetPath = path.join(store.target.cwd, 'node_modules', dep.name);
      syncWatcher.watch(dep.path, targetPath);
    }

    const [devCmd, ...devArgs] = store.target.devScript.split(' ');
    if (devCmd) {
      processManager.spawnProcess(devCmd, devArgs, 'dev');
    }
  } catch (error) {
    store.setPipelineStatus('error');
    throw error;
  }
}
