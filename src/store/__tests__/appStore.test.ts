import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '../appStore.js';

describe('useAppStore', () => {
  const initialState = useAppStore.getState();

  beforeEach(() => {
    useAppStore.setState(initialState, true);
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.target.name).toBe('mi-app');
    expect(state.dependencies.length).toBe(2);
    expect(state.logs.length).toBe(3);
    expect(state.activeProcesses.length).toBe(3);
    expect(state.timeline.length).toBe(3);
    expect(state.containerDirs).toEqual(['~/projects']);
  });

  it('should set the target correctly', () => {
    useAppStore.getState().setTarget({ name: 'new-target', version: 'v3.0.0' });
    const state = useAppStore.getState();
    expect(state.target.name).toBe('new-target');
    expect(state.target.version).toBe('v3.0.0');
    expect(state.target.branch).toBe('main');
  });

  it('should set dependencies correctly', () => {
    useAppStore.getState().setDependencies([]);
    const state = useAppStore.getState();
    expect(state.dependencies).toEqual([]);
  });

  it('should add a log entry correctly', () => {
    const newLog = { prefix: '[test]', message: 'test log', color: 'red' };
    useAppStore.getState().addLog(newLog);
    const state = useAppStore.getState();
    expect(state.logs[state.logs.length - 1]).toEqual(newLog);
  });

  it('should set active processes correctly', () => {
    useAppStore.getState().setActiveProcesses([]);
    const state = useAppStore.getState();
    expect(state.activeProcesses).toEqual([]);
  });

  it('should set timeline correctly', () => {
    useAppStore.getState().setTimeline([]);
    const state = useAppStore.getState();
    expect(state.timeline).toEqual([]);
  });
});
