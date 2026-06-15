import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ink from 'ink';
import { render } from 'ink-testing-library';

import { useTerminalSize } from '../useTerminalSize.js';

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: vi.fn(),
  };
});

describe('useTerminalSize', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const TestComponent = (): React.ReactNode => {
    const size = useTerminalSize();
    return <ink.Text>{JSON.stringify(size)}</ink.Text>;
  };

  const mockUseStdout = vi.mocked(
    ink.useStdout as () => {
      stdout: NodeJS.WriteStream | undefined;
      write: (data: string) => void;
    }
  );

  it('should return default size (80x24) if stdout is not available', () => {
    mockUseStdout.mockReturnValue({
      stdout: undefined,
      write: vi.fn(),
    });

    const { lastFrame } = render(<TestComponent />);
    expect(lastFrame()).toBe('{"columns":80,"rows":24}');
  });

  it('should return the current size of stdout', () => {
    mockUseStdout.mockReturnValue({
      stdout: Object.assign(Object.create(process.stdout), {
        columns: 100,
        rows: 50,
        on: vi.fn(),
        off: vi.fn(),
      }),
      write: vi.fn(),
    });

    const { lastFrame } = render(<TestComponent />);
    expect(lastFrame()).toBe('{"columns":100,"rows":50}');
  });

  it('should update size when resize event is triggered', async () => {
    let resizeCallback: () => void = () => {};
    const mockStdout = Object.assign(Object.create(process.stdout), {
      columns: 100,
      rows: 50,
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'resize') {
          resizeCallback = callback;
        }
      }),
      off: vi.fn(),
    });

    mockUseStdout.mockReturnValue({
      stdout: mockStdout,
      write: vi.fn(),
    });

    const { lastFrame } = render(<TestComponent />);
    expect(lastFrame()).toBe('{"columns":100,"rows":50}');

    // Wait for useEffect
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate resize
    mockStdout.columns = 120;
    mockStdout.rows = 60;

    act(() => {
      resizeCallback();
    });

    // Wait for re-render
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(lastFrame()).toBe('{"columns":120,"rows":60}');
  });

  it('should clean up event listener on unmount', async () => {
    const mockStdout = Object.assign(Object.create(process.stdout), {
      columns: 100,
      rows: 50,
      on: vi.fn(),
      off: vi.fn(),
    });

    mockUseStdout.mockReturnValue({
      stdout: mockStdout,
      write: vi.fn(),
    });

    const { unmount } = render(<TestComponent />);

    // Wait for useEffect
    await new Promise(resolve => setTimeout(resolve, 0));

    unmount();

    // Wait for React to process unmount and run cleanup effects
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockStdout.off).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
