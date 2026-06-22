import chokidar from 'chokidar';
import { execa } from 'execa';

import { runRsync } from './execution.js';

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
    const child = execa(watchScript, {
      cwd: sourceDir,
      shell: true,
      stdio: 'ignore',
      cleanup: true,
      detached: true,
    });

    // Handle background errors
    child.catch(() => {
      // Ignore background compilation process exits
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

    watcher.on('all', () => {
      // Trigger debounced sync
      const existingTimer = this.debounceTimers.get(depName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const newTimer = setTimeout(() => {
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
        await runRsync(sourceDir, destDir);
      } catch {
        // Log error internally but do not crash the orchestrator
      }
    });

    this.syncQueues.set(depName, nextQueue);
  }

  /**
   * Stops all watchers, clears timers, and kills all background subprocesses.
   */
  public async stopAll(): Promise<void> {
    // 1. Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // 2. Close all chokidar watchers
    for (const watcher of this.watchers.values()) {
      try {
        await watcher.close();
      } catch {
        // Ignore
      }
    }
    this.watchers.clear();

    // 3. Kill all compilers
    for (const child of this.compilers.values()) {
      try {
        if (child.pid) {
          process.kill(-child.pid);
        } else {
          child.kill();
        }
      } catch {
        try {
          child.kill();
        } catch {
          // Ignore
        }
      }
    }
    this.compilers.clear();
    this.syncQueues.clear();
  }

  /**
   * Gets the count of active compilers.
   */
  public getActiveCompilersCount(): number {
    return this.compilers.size;
  }
}

export const dependencyOrchestrator = new DependencyOrchestrator();
