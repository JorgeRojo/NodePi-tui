import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { TargetPanel } from '../TargetPanel.js';

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: (selector: any) =>
    selector({
      target: {
        name: 'test-app',
        branch: 'main',
        version: '1.0.0',
        devScript: 'npm run dev',
        cwd: '/current/dir',
      },
    }),
}));

describe('TargetPanel', () => {
  it('renders target info from store', () => {
    const { lastFrame } = render(<TargetPanel />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Target: test-app');
    expect(frame).toContain('[main]');
    expect(frame).toContain('Version: 1.0.0');
    expect(frame).toContain('Selected Dev Script: npm run dev');
  });
});
