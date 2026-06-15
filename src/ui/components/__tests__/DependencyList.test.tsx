import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { DependencyList } from '../DependencyList.js';

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: (selector: any) =>
    selector({
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
