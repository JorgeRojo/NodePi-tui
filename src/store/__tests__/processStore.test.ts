import { beforeEach, describe, expect, it } from 'vitest';

import type { ProcessData } from '../../core/execution/types.js';
import { processStore } from '../processStore.js';

describe('processStore', () => {
  beforeEach(() => {
    // Reset store before each test
    processStore.setState({ processes: {} });
  });

  it('should add a process', () => {
    const process: ProcessData = {
      pid: 123,
      type: 'dev',
      status: 'running',
      command: 'npm run dev',
      logs: [],
    };

    processStore.getState().addProcess(process);

    expect(processStore.getState().processes[123]).toEqual(process);
  });

  it('should update process status', () => {
    const process: ProcessData = {
      pid: 123,
      type: 'dev',
      status: 'running',
      command: 'npm run dev',
      logs: [],
    };
    processStore.getState().addProcess(process);

    processStore.getState().updateProcessStatus(123, 'stopped');

    expect(processStore.getState().processes[123]?.status).toBe('stopped');
  });

  it('should remove a process', () => {
    const process: ProcessData = {
      pid: 123,
      type: 'dev',
      status: 'running',
      command: 'npm run dev',
      logs: [],
    };
    processStore.getState().addProcess(process);

    processStore.getState().removeProcess(123);

    expect(processStore.getState().processes[123]).toBeUndefined();
  });

  it('should append log', () => {
    const process: ProcessData = {
      pid: 123,
      type: 'dev',
      status: 'running',
      command: 'npm run dev',
      logs: ['Initial log'],
    };
    processStore.getState().addProcess(process);

    processStore.getState().appendLog(123, 'New log');

    expect(processStore.getState().processes[123]?.logs).toEqual([
      'Initial log',
      'New log',
    ]);
  });

  it('should overwrite last log line when requested', () => {
    const process: ProcessData = {
      pid: 123,
      type: 'dev',
      status: 'running',
      command: 'npm run dev',
      logs: ['Initial log', 'Downloading 50%'],
    };
    processStore.getState().addProcess(process);

    processStore.getState().appendLog(123, 'Downloading 100%', true);

    expect(processStore.getState().processes[123]?.logs).toEqual([
      'Initial log',
      'Downloading 100%',
    ]);
  });

  it('should fallback to push if overwrite requested but no logs exist', () => {
    const process: ProcessData = {
      pid: 123,
      type: 'dev',
      status: 'running',
      command: 'npm run dev',
      logs: [],
    };
    processStore.getState().addProcess(process);

    processStore.getState().appendLog(123, 'First log', true);

    expect(processStore.getState().processes[123]?.logs).toEqual(['First log']);
  });
});
