import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { DependencyList } from '../DependencyList.js';

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: vi.fn((selector?: any) => {
    const state = {
      dependencies: [
        {
          name: 'dep-a',
          type: 'local',
          version: '1.0',
          path: '/path/to/a',
          enabled: true,
        },
        {
          name: 'dep-b',
          type: 'remote',
          version: '2.0',
          path: '/path/to/b',
          enabled: false,
        },
      ],
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

describe('DependencyList', () => {
  it('renders dependencies correctly', () => {
    const { lastFrame } = render(<DependencyList />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Local Dependencies');
    expect(frame).toContain('dep-a');
    expect(frame).toContain('dep-b');
    expect(frame).toContain('Enabled');
    expect(frame).toContain('Disabled');
  });
});
