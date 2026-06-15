import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { execa } from 'execa';

export class SyncWatcher {
  private _watchers: Map<string, FSWatcher> = new Map();
  private _syncing: Set<string> = new Set();

  public watch(source: string, target: string): void {
    if (this._watchers.has(source)) {
      return;
    }

    const watcher = chokidar.watch(source, {
      ignored: /node_modules/,
      ignoreInitial: true,
      persistent: true,
    });

    const triggerSync = async (): Promise<void> => {
      if (this._syncing.has(source)) {
        return;
      }
      this._syncing.add(source);
      try {
        await execa('rsync', [
          '-avz',
          '--exclude',
          'node_modules',
          source,
          target,
        ]);
      } catch {
        // Silently catch errors as console.log is forbidden
      } finally {
        this._syncing.delete(source);
      }
    };

    watcher.on('all', () => {
      triggerSync().catch(() => {});
    });

    this._watchers.set(source, watcher);
  }

  public async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const watcher of this._watchers.values()) {
      promises.push(watcher.close());
    }
    await Promise.all(promises);
    this._watchers.clear();
    this._syncing.clear();
  }
}

export const syncWatcher = new SyncWatcher();
