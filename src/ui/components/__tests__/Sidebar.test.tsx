import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { Sidebar } from '../Sidebar.js';

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: (selector: any) =>
    selector({
      activeProcesses: [{ type: 'DEV', name: 'dev-proc', pid: 1234 }],
      timeline: [
        { name: 'event1', role: 'test', isTarget: true, version: '1.0' },
        { name: 'event2', role: 'dep', isTarget: false, version: '2.0' },
      ],
      containerDirs: ['/dir1'],
    }),
}));

describe('Sidebar', () => {
  it('renders sidebar panels correctly', () => {
    const { lastFrame } = render(<Sidebar />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Active Processes');
    expect(frame).toContain('dev-proc');
    expect(frame).toContain('1234');
    expect(frame).toContain('Dependency Timeline');
    expect(frame).toContain('event1');
    expect(frame).toContain('test');
    expect(frame).toContain('Container Directories');
    expect(frame).toContain('/dir1');
  });
});
