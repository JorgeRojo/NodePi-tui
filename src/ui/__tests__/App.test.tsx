import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { App } from '../App.js';
import * as useTerminalSizeModule from '../hooks/useTerminalSize.js';

// Mock the hook
vi.mock('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: vi.fn(),
}));

// Mock the store to avoid useSyncExternalStore issues during tests with ink-testing-library
vi.mock('../../store/appStore.js', () => ({
  useAppStore: vi.fn((selector?: any) => {
    const state = {
      target: {
        name: 'mi-app',
        branch: 'main',
        version: 'v2.1.0',
        devScript: 'pnpm run dev',
        cwd: '~/projects/mi-app',
      },
      dependencies: [],
      activeProcesses: [],
      timeline: [],
      logs: [],
      containerDirs: [],
      focusedDependencyIndex: 0,
      activeModal: 'none',
      setTarget: vi.fn(),
      setDependencies: vi.fn(),
      setActiveProcesses: vi.fn(),
      setTimeline: vi.fn(),
      addLog: vi.fn(),
      setFocusedDependencyIndex: vi.fn(),
      setActiveModal: vi.fn(),
      toggleDependency: vi.fn(),
      toggleDependencyMode: vi.fn(),
      removeDependency: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

describe('App Component', (): void => {
  afterEach((): void => {
    vi.clearAllMocks();
  });

  it('renders a warning screen when terminal is too small (columns < 80)', (): void => {
    vi.mocked(useTerminalSizeModule.useTerminalSize).mockReturnValue({
      columns: 79,
      rows: 24,
    });
    const { lastFrame } = render(<App />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Terminal too small!');
    expect(frame).toContain('Current: 79x24');
  });

  it('renders a warning screen when terminal is too small (rows < 24)', (): void => {
    vi.mocked(useTerminalSizeModule.useTerminalSize).mockReturnValue({
      columns: 80,
      rows: 23,
    });
    const { lastFrame } = render(<App />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Terminal too small!');
    expect(frame).toContain('Current: 80x23');
  });

  it('renders the full layout with Sidebar when columns >= 100', (): void => {
    vi.mocked(useTerminalSizeModule.useTerminalSize).mockReturnValue({
      columns: 100,
      rows: 30,
    });
    const { lastFrame } = render(<App />);
    const frame = lastFrame() || '';

    // Header
    expect(frame).toContain('NodePi v1.0.0');
    // Main Panel (Target)
    expect(frame).toContain('Target:');
    // Sidebar
    expect(frame).toContain('Active Processes');
    expect(frame).toContain('Dependency Timeline');
    expect(frame).toContain('Container Directories');
  });

  it('renders the layout without Sidebar when 80 <= columns < 100', (): void => {
    vi.mocked(useTerminalSizeModule.useTerminalSize).mockReturnValue({
      columns: 99,
      rows: 30,
    });
    const { lastFrame } = render(<App />);
    const frame = lastFrame() || '';

    // Header
    expect(frame).toContain('NodePi v1.0.0');
    // Main Panel (Target)
    expect(frame).toContain('Target:');
    // Sidebar should NOT be rendered
    expect(frame).not.toContain('Active Processes');
    expect(frame).not.toContain('Dependency Timeline');
    expect(frame).not.toContain('Container Directories');
  });
});
