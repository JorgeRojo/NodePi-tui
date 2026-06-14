import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { App } from '../App.js';

describe('App Component', (): void => {
  afterEach((): void => {
    vi.clearAllMocks();
  });

  it('renders the NodePi Initialization text correctly', (): void => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain('NodePi Initialization...');
  });
});
