import { execa } from 'execa';

import { processStore } from '../../store/processStore.js';
import type { ProcessType } from './types.js';
import { LogParser } from './LogParser.js';

export class ProcessManager {
  private static _instance: ProcessManager;

  private constructor() {}

  public static getInstance(): ProcessManager {
    if (!ProcessManager._instance) {
      ProcessManager._instance = new ProcessManager();
    }
    return ProcessManager._instance;
  }

  public spawnProcess(cmd: string, args: string[], type: ProcessType): void {
    const fullArgs = ['-q', '/dev/null', cmd, ...args];

    const child = execa('script', fullArgs, {
      detached: true,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { FORCE_COLOR: '1', COLORTERM: 'truecolor', TERM: 'xterm-256color' },
    });

    if (child.pid === undefined) {
      return;
    }

    const pid = child.pid;

    processStore.getState().addProcess({
      pid,
      type,
      status: 'running',
      command: `${cmd} ${args.join(' ')}`,
      logs: [],
    });

    const logParser = new LogParser((line: string, overwrite: boolean) => {
      processStore.getState().appendLog(pid, line, overwrite);
    });

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        logParser.parse(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        logParser.parse(chunk);
      });
    }

    child
      .catch(() => {
        // Ignore the promise rejection as we handle state via store
      })
      .finally(() => {
        logParser.flush();
        processStore.getState().updateProcessStatus(pid, 'stopped');
      });
  }

  public spawnShellProcess(
    name: string,
    commandString: string,
    type: ProcessType
  ): void {
    const fullArgs = ['-q', '/dev/null', 'sh', '-c', commandString];

    const child = execa('script', fullArgs, {
      detached: true,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { FORCE_COLOR: '1', COLORTERM: 'truecolor', TERM: 'xterm-256color' },
    });

    if (child.pid === undefined) {
      return;
    }

    const pid = child.pid;

    processStore.getState().addProcess({
      pid,
      type,
      status: 'running',
      command: name,
      logs: [],
    });

    const logParser = new LogParser((line: string, overwrite: boolean) => {
      processStore.getState().appendLog(pid, line, overwrite);
    });

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        logParser.parse(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        logParser.parse(chunk);
      });
    }

    child
      .catch(() => {
        // Ignore the promise rejection as we handle state via store
      })
      .finally(() => {
        logParser.flush();
        processStore.getState().updateProcessStatus(pid, 'stopped');
      });
  }

  public killProcess(pid: number): void {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch (error: unknown) {
      const isESRCH =
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'ESRCH';

      if (!isESRCH) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        processStore
          .getState()
          .appendLog(
            pid,
            `Failed to kill process ${pid}: ${errorMessage}`,
            false
          );
      }
    } finally {
      processStore.getState().updateProcessStatus(pid, 'stopped');
    }
  }
}

export const processManager = ProcessManager.getInstance();
