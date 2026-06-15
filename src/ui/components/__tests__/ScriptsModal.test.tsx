import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// We need to import ink to use it in the mock
import * as import_ink from 'ink';
import { render } from 'ink-testing-library';

import { ScriptsModal } from '../ScriptsModal.js';

const mockSetActiveModal = vi.fn();
const mockAddCustomScript = vi.fn();

vi.mock('../../../store/appStore.js', () => ({
  useAppStore: vi.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      setActiveModal: mockSetActiveModal,
      addCustomScript: mockAddCustomScript,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@inkjs/ui', () => ({
  Select: ({
    options,
    onChange,
  }: {
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
  }) => {
    return (
      <import_ink.Box>
        <import_ink.Text>MockSelect</import_ink.Text>
        {options.map(opt => (
          <import_ink.Text key={opt.value}>{opt.label}</import_ink.Text>
        ))}
      </import_ink.Box>
    );
  },
  TextInput: ({
    placeholder,
    onSubmit,
  }: {
    placeholder: string;
    onSubmit: (value: string) => void;
  }) => {
    return <import_ink.Text>MockTextInput: {placeholder}</import_ink.Text>;
  },
}));

describe('ScriptsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the initial step correctly', async () => {
    const { lastFrame } = render(
      <import_ink.Box width={100} height={100}>
        <ScriptsModal />
      </import_ink.Box>
    );

    // Give it a tick to render
    await new Promise(r => setTimeout(r, 50));

    const frame = lastFrame() || '';

    expect(frame).toContain('Add Custom Script');
    expect(frame).toContain('Select script type:');
    expect(frame).toContain('pre-build');
    expect(frame).toContain('build');
    expect(frame).toContain('dev');
    expect(frame).toContain('watch');
  });

  it('calls setActiveModal("none") when Escape is pressed', async () => {
    const { stdin } = render(
      <import_ink.Box width={100} height={100}>
        <ScriptsModal />
      </import_ink.Box>
    );

    await new Promise(r => setTimeout(r, 50));

    // Simulate Escape key press
    stdin.write('\x1B');

    await new Promise(r => setTimeout(r, 50));

    expect(mockSetActiveModal).toHaveBeenCalledWith('none');
  });
});
