import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { Footer } from '../Footer.js';

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: (selector: any) =>
    selector({
      target: {
        name: 'test-app',
        branch: 'develop',
        version: '1.0.0',
        devScript: 'npm run dev',
        cwd: '/current/dir',
      },
    }),
}));

describe('Footer', () => {
  it('renders footer info and actions correctly', () => {
    const { lastFrame } = render(<Footer />);
    const frame = lastFrame() || '';
    expect(frame).toContain('CWD: /current/dir');
    expect(frame).toContain('Branch: develop');
    expect(frame).toContain('[r] Run');
  });
});
