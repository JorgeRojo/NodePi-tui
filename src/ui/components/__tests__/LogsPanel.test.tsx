import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { LogsPanel } from '../LogsPanel.js';

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: (selector: any) =>
    selector({
      logs: [{ message: 'Hello World', prefix: 'sys', color: 'blue' }],
    }),
}));

describe('LogsPanel', () => {
  it('renders logs correctly', () => {
    const { lastFrame } = render(<LogsPanel />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Console Logs');
    expect(frame).toContain('Hello World');
    expect(frame).toContain('sys');
  });
});
