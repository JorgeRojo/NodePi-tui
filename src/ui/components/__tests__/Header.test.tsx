import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';

import { Header } from '../Header.js';

describe('Header', () => {
  it('renders correctly', () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain('NodePi v1.0.0');
  });
});
