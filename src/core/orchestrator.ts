import chokidar from 'chokidar';
import { execa } from 'execa';

import { runRsync } from './execution.js';
import { logger } from './logger.js';

export class DependencyOrchestrator {
  private compilers = new Map<string, any>();
  private watchers = new Map<string, chokidar.FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private syncQueues = new Map<string, Promise<void>>();

  /**
   * Spawns a background watch compiler (e.g. tsc -w) for a dependency.
   */
  public async spawnCompiler(
    depName: string,
    sourceDir: string,
    watchScript: string
  ): Promise<void> {
    logger.info('Compiler', `Spawning compiler for "${depName}" in "${sourceDir}" with script: "${watchScript}"`);

    const child = execa(watchScript, {
      cwd: sourceDir,
      shell: true,
      stdio: 'pipe',
      cleanup: true,
      detached: true,
    });

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            logger.info(`Compiler:${depName}`, line.trim());
          }
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            logger.error(`Compiler:${depName}`, line.trim());
          }
        }
      });
    }

    // Handle background errors
    child.catch((err: any) => {
      logger.error('Compiler', `Background compiler for "${depName}" exited/failed: ${err.message}`);
    });

    this.compilers.set(depName, child);
  }

  /**
   * Starts a chokidar watcher on a dependency's output directory.
   * Debounces changes and schedules them to run sequentially via rsync.
   */
  public async startWatching(
    depName: string,
    sourceDir: string,
    destDir: string
  ): Promise<void> {
    logger.info('Watcher', `Starting file watcher for "${depName}" at "${sourceDir}"`);

    // Initialize the queue for this dependency if not present
    if (!this.syncQueues.has(depName)) {
      this.syncQueues.set(depName, Promise.resolve());
    }

    const watcher = chokidar.watch(sourceDir, {
      ignored: p =>
        p.includes('node_modules') ||
        p.includes('.git') ||
        p.includes('.nodepi'),
      ignoreInitial: true,
    });

    watcher.on('all', (event, filePath) => {
      logger.info('Watcher', `[${depName}] Change detected (${event}): "${filePath}"`);

      // Trigger debounced sync
      const existingTimer = this.debounceTimers.get(depName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const newTimer = setTimeout(() => {
        logger.info('Watcher', `[${depName}] Debounce limit reached. Enqueueing synchronization...`);
        this.enqueueSync(depName, sourceDir, destDir);
      }, 150);

      this.debounceTimers.set(depName, newTimer);
    });

    this.watchers.set(depName, watcher);
  }

  /**
   * Enqueues a sync operation for a dependency to guarantee serial execution.
   */
  private enqueueSync(
    depName: string,
    sourceDir: string,
    destDir: string
  ): void {
    const currentQueue = this.syncQueues.get(depName) || Promise.resolve();

    const nextQueue = currentQueue.then(async () => {
      try {
        logger.info('Rsync', `Running rsync for "${depName}": "${sourceDir}" -> "${destDir}"`);
        await runRsync(sourceDir, destDir);
        logger.info('Rsync', `Rsync completed successfully for "${depName}"`);
      } catch (err: any) {
        logger.error('Rsync', `Rsync execution failed for "${depName}": ${err.message}`);
      }
    });

    this.syncQueues.set(depName, nextQueue);
  }

  /**
   * Stops all watchers, clears timers, and kills all background subprocesses.
   */
  public async stopAll(): Promise<void> {
    logger.info('Orchestrator', 'Stopping all background compilers, watchers, and processes...');

    // 1. Clear all timers
    for (const [depName, timer] of this.debounceTimers.entries()) {
      logger.debug('Orchestrator', `Clearing debounce timer for "${depName}"`);
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // 2. Close all chokidar watchers
    for (const [depName, watcher] of this.watchers.entries()) {
      try {
        logger.info('Orchestrator', `Closing watcher for "${depName}"`);
        await watcher.close();
      } catch (err: any) {
        logger.error('Orchestrator', `Error closing watcher for "${depName}": ${err.message}`);
      }
    }
    this.watchers.clear();

    // 3. Kill all compilers
    for (const [depName, child] of this.compilers.entries()) {
      try {
        logger.info('Orchestrator', `Terminating compiler process for "${depName}"`);
        if (child.pid) {
          process.kill(-child.pid);
        } else {
          child.kill();
        }
      } catch (err: any) {
        logger.debug('Orchestrator', `Normal kill failed for compiler "${depName}" (pid: ${child.pid}), falling back to direct kill: ${err.message}`);
        try {
          child.kill();
        } catch (innerErr: any) {
          logger.error('Orchestrator', `Failed to terminate compiler "${depName}": ${innerErr.message}`);
        }
      }
    }
    this.compilers.clear();
    this.syncQueues.clear();
    logger.info('Orchestrator', 'All background processes stopped.');
  }

  /**
   * Gets the count of active compilers.
   */
  public getActiveCompilersCount(): number {
    return this.compilers.size;
  }
}

export const dependencyOrchestrator = new DependencyOrchestrator();
