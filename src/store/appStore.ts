import { create } from 'zustand';

import { writeConfig } from '../core/config-manager/io.js';

export interface Dependency {
  name: string;
  type: string;
  version: string;
  path: string;
  enabled: boolean;
}

export interface ActiveProcess {
  name: string;
  type: string;
  pid: number;
}

export interface TimelineEvent {
  name: string;
  role: string;
  version?: string;
  isTarget?: boolean;
}

export interface LogEntry {
  prefix: string;
  message: string;
  color: string;
}

export interface AppState {
  target: {
    name: string;
    branch: string;
    version: string;
    devScript: string;
    cwd: string;
  };
  dependencies: Dependency[];
  activeProcesses: ActiveProcess[];
  timeline: TimelineEvent[];
  logs: LogEntry[];
  containerDirs: string[];

  focusedDependencyIndex: number;
  activeModal: 'none' | 'add' | 'config';

  // Actions
  setTarget: (target: Partial<AppState['target']>) => void;
  setDependencies: (deps: Dependency[]) => void;
  setActiveProcesses: (processes: ActiveProcess[]) => void;
  setTimeline: (timeline: TimelineEvent[]) => void;
  addLog: (log: LogEntry) => void;
  setFocusedDependencyIndex: (index: number) => void;
  setActiveModal: (modal: 'none' | 'add' | 'config') => void;
  toggleDependency: (name: string) => void;
  toggleDependencyMode: (name: string) => void;
  removeDependency: (name: string) => void;
}

export const useAppStore = create<AppState>(set => ({
  target: {
    name: 'mi-app',
    branch: 'main',
    version: 'v2.1.0',
    devScript: 'pnpm run dev',
    cwd: '~/projects/mi-app',
  },
  dependencies: [
    {
      name: 'lib-a',
      type: 'Sync',
      version: 'v1.0.2',
      path: '~/lib-a',
      enabled: true,
    },
    {
      name: 'lib-b',
      type: 'Inject',
      version: 'v2.0.0',
      path: '~/lib-b',
      enabled: false,
    },
  ],
  activeProcesses: [
    { name: 'mi-app', type: 'DEV', pid: 43291 },
    { name: 'lib-a', type: 'WATCH', pid: 43295 },
    { name: 'lib-a', type: 'SYNC', pid: 43296 },
  ],
  timeline: [
    { name: 'mi-app', role: 'Target CWD', isTarget: true },
    { name: 'lib-a', role: 'Sync', version: 'v1.0.2' },
    { name: 'lib-b', role: 'Inject', version: 'v2.0.0' },
  ],
  logs: [
    { prefix: '[lib-a] [watch]', message: 'tsc --watch', color: 'blueBright' },
    {
      prefix: '[lib-a] [watch]',
      message: 'TypeScript compilation ok',
      color: 'blueBright',
    },
    {
      prefix: '[mi-app] [dev]',
      message: 'Vite server running on port 3000',
      color: 'green',
    },
  ],
  containerDirs: ['~/projects'],
  focusedDependencyIndex: 0,
  activeModal: 'none',

  setTarget: (target): void =>
    set(
      (state): Partial<AppState> => ({ target: { ...state.target, ...target } })
    ),
  setDependencies: (dependencies): void => set({ dependencies }),
  setActiveProcesses: (activeProcesses): void => set({ activeProcesses }),
  setTimeline: (timeline): void => set({ timeline }),
  addLog: (log): void =>
    set((state): Partial<AppState> => ({ logs: [...state.logs, log] })),
  setFocusedDependencyIndex: (index): void =>
    set({ focusedDependencyIndex: index }),
  setActiveModal: (modal): void => set({ activeModal: modal }),
  toggleDependency: (name): void =>
    set((state): Partial<AppState> => {
      const dependencies = state.dependencies.map(dep =>
        dep.name === name ? { ...dep, enabled: !dep.enabled } : dep
      );
      const depsRecord: Record<string, any> = {};
      dependencies.forEach(d => {
        depsRecord[d.name] = {
          type: d.type,
          enabled: d.enabled,
          version: d.version,
          path: d.path,
        };
      });
      void writeConfig(state.target.cwd, {
        containers: state.containerDirs,
        dependencies: depsRecord,
      });
      return { dependencies };
    }),
  toggleDependencyMode: (name): void =>
    set((state): Partial<AppState> => {
      const dependencies = state.dependencies.map(dep =>
        dep.name === name
          ? { ...dep, type: dep.type === 'Sync' ? 'Inject' : 'Sync' }
          : dep
      );
      const depsRecord: Record<string, any> = {};
      dependencies.forEach(d => {
        depsRecord[d.name] = {
          type: d.type,
          enabled: d.enabled,
          version: d.version,
          path: d.path,
        };
      });
      void writeConfig(state.target.cwd, {
        containers: state.containerDirs,
        dependencies: depsRecord,
      });
      return { dependencies };
    }),
  removeDependency: (name): void =>
    set((state): Partial<AppState> => {
      const dependencies = state.dependencies.filter(dep => dep.name !== name);
      const depsRecord: Record<string, any> = {};
      dependencies.forEach(d => {
        depsRecord[d.name] = {
          type: d.type,
          enabled: d.enabled,
          version: d.version,
          path: d.path,
        };
      });
      void writeConfig(state.target.cwd, {
        containers: state.containerDirs,
        dependencies: depsRecord,
      });
      return {
        dependencies,
        focusedDependencyIndex: Math.max(
          0,
          Math.min(state.focusedDependencyIndex, dependencies.length - 1)
        ),
      };
    }),
}));

// We also need to save when `setDependencies` or adding from modal happens.
// Subscribe to store changes manually or add it to setDependencies.
