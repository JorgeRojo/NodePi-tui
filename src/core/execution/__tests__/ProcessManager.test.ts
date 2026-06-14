import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { execa } from 'execa';

import { processStore } from '../../../store/processStore.js';
import { ProcessManager, processManager } from '../ProcessManager.js';

vi.mock('execa');

describe('ProcessManager', () => {
  let stdoutMock: EventEmitter;
  let stderrMock: EventEmitter;
  interface MockChildProcess {
    pid?: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    catch: ReturnType<typeof vi.fn>;
    finally: ReturnType<typeof vi.fn>;
    finallyCb?: () => void;
  }
  let childProcessMock: MockChildProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    processStore.setState({ processes: {} });

    stdoutMock = new EventEmitter();
    stderrMock = new EventEmitter();

    childProcessMock = {
      pid: 12345,
      stdout: stdoutMock,
      stderr: stderrMock,
      catch: vi.fn().mockReturnThis(),
      finally: vi.fn().mockImplementation((cb: () => void) => {
        childProcessMock.finallyCb = cb;
        return childProcessMock;
      }),
    };

    vi.mocked(execa).mockReturnValue(childProcessMock as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn a process and add it to the store', () => {
    processManager.spawnProcess('echo', ['hello'], 'dev');

    expect(execa).toHaveBeenCalledWith(
      'script',
      ['-q', '/dev/null', 'echo', 'hello'],
      {
        detached: true,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          FORCE_COLOR: '1',
          COLORTERM: 'truecolor',
          TERM: 'xterm-256color',
        },
      }
    );

    const state = processStore.getState();
    expect(state.processes[12345]).toEqual({
      pid: 12345,
      type: 'dev',
      status: 'running',
      command: 'echo hello',
      logs: [],
    });
  });

  it('should not add to store if pid is undefined', () => {
    childProcessMock.pid = undefined;
    processManager.spawnProcess('echo', ['hello'], 'dev');

    const state = processStore.getState();
    expect(Object.keys(state.processes).length).toBe(0);
  });

  it('should append logs to the store when stdout emits data', () => {
    processManager.spawnProcess('echo', ['hello'], 'dev');

    stdoutMock.emit('data', Buffer.from('test log\n'));

    const state = processStore.getState();
    expect(state.processes[12345]?.logs).toEqual(['test log']);
  });

  it('should append logs to the store when stderr emits data', () => {
    processManager.spawnProcess('echo', ['error'], 'dev');

    stderrMock.emit('data', Buffer.from('test error\n'));

    const state = processStore.getState();
    expect(state.processes[12345]?.logs).toEqual(['test error']);
  });

  it('should update process status to stopped on finally', () => {
    processManager.spawnProcess('echo', ['hello'], 'dev');

    expect(processStore.getState().processes[12345]?.status).toBe('running');

    // Simulate process end
    (childProcessMock.finallyCb as () => void)();

    expect(processStore.getState().processes[12345]?.status).toBe('stopped');
  });

  it('should kill process by PID', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    processManager.spawnProcess('echo', ['hello'], 'dev');
    processManager.killProcess(12345);

    expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGKILL');
    expect(processStore.getState().processes[12345]?.status).toBe('stopped');
  });

  it('should handle ESRCH error gracefully when killing process', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      const error = new Error('No such process');
      Object.assign(error, { code: 'ESRCH' });
      throw error;
    });

    processManager.spawnProcess('echo', ['hello'], 'dev');
    processManager.killProcess(12345);

    expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGKILL');
    expect(processStore.getState().processes[12345]?.logs).toEqual([]);
    expect(processStore.getState().processes[12345]?.status).toBe('stopped');
  });

  it('should log other errors when killing process fails', () => {
    const error = new Error('Permission denied');
    Object.assign(error, { code: 'EPERM' });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw error;
    });

    processManager.spawnProcess('echo', ['hello'], 'dev');
    processManager.killProcess(12345);

    expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGKILL');
    expect(processStore.getState().processes[12345]?.logs).toContain(
      'Failed to kill process 12345: Permission denied'
    );
    expect(processStore.getState().processes[12345]?.status).toBe('stopped');
  });

  it('should return singleton instance', () => {
    const instance1 = ProcessManager.getInstance();
    const instance2 = ProcessManager.getInstance();
    expect(instance1).toBe(instance2);
  });
});
