import { useInput } from 'ink';

import { runPipeline } from '../../core/execution/orchestrator.js';
import { processManager } from '../../core/execution/ProcessManager.js';
import { useAppStore } from '../../store/appStore.js';
import { processStore } from '../../store/processStore.js';

export const useGlobalKeybindings = (): void => {
  const activeModal = useAppStore(state => state.activeModal);
  const pipelineStatus = useAppStore(state => state.pipelineStatus);
  const setPipelineStatus = useAppStore(state => state.setPipelineStatus);

  useInput(input => {
    if (activeModal !== 'none') {
      return;
    }

    if (input === 'r') {
      if (pipelineStatus === 'idle' || pipelineStatus === 'error') {
        void runPipeline(false);
      }
    } else if (input === 'f') {
      if (pipelineStatus === 'idle' || pipelineStatus === 'error') {
        void runPipeline(true);
      }
    } else if (input === 's') {
      const processes = processStore.getState().processes;
      for (const pidStr in processes) {
        const pid = Number(pidStr);
        const p = processes[pid];
        if (p?.status === 'running') {
          processManager.killProcess(pid);
        }
      }
      setPipelineStatus('idle');
    }
  });
};
