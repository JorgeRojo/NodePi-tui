export type ProcessType = 'dev' | 'watch' | 'sync';

export type ProcessStatus = 'running' | 'stopped' | 'error';

export interface ProcessData {
  pid: number;
  type: ProcessType;
  status: ProcessStatus;
  command: string;
  logs: string[];
}
