import { createStore } from 'zustand/vanilla';

import type { ProcessData, ProcessStatus } from '../core/execution/types.js';

export interface ProcessState {
  processes: Record<number, ProcessData>;
  addProcess: (processData: ProcessData) => void;
  updateProcessStatus: (pid: number, status: ProcessStatus) => void;
  removeProcess: (pid: number) => void;
  appendLog: (
    pid: number,
    logLine: string,
    overwriteLastLine?: boolean
  ) => void;
}

export const processStore = createStore<ProcessState>(set => ({
  processes: {},
  addProcess: (processData: ProcessData): void =>
    set(state => ({
      processes: { ...state.processes, [processData.pid]: processData },
    })),
  updateProcessStatus: (pid: number, status: ProcessStatus): void =>
    set(state => {
      const process = state.processes[pid];
      if (!process) return state;
      return {
        processes: {
          ...state.processes,
          [pid]: { ...process, status },
        },
      };
    }),
  removeProcess: (pid: number): void =>
    set(state => {
      const { [pid]: _, ...rest } = state.processes;
      return { processes: rest };
    }),
  appendLog: (
    pid: number,
    logLine: string,
    overwriteLastLine: boolean = false
  ): void =>
    set(state => {
      const process = state.processes[pid];
      if (!process) return state;

      const newLogs = [...process.logs];
      if (overwriteLastLine && newLogs.length > 0) {
        newLogs[newLogs.length - 1] = logLine;
      } else {
        newLogs.push(logLine);
      }

      return {
        processes: {
          ...state.processes,
          [pid]: { ...process, logs: newLogs },
        },
      };
    }),
}));
