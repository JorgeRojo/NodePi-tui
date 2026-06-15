import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Select, TextInput } from '@inkjs/ui';

import { useAppStore } from '../../store/appStore.js';

export const ScriptsModal = (): React.JSX.Element => {
  const { setActiveModal, addCustomScript } = useAppStore();

  const [step, setStep] = useState<'type' | 'name' | 'command'>('type');
  const [scriptType, setScriptType] = useState<string>('');
  const [scriptName, setScriptName] = useState<string>('');

  useInput((input, key) => {
    if (key.escape) {
      setActiveModal('none');
    }
  });

  const typeOptions = [
    { label: 'pre-build', value: 'pre-build' },
    { label: 'build', value: 'build' },
    { label: 'dev', value: 'dev' },
    { label: 'watch', value: 'watch' },
  ];

  return (
    <Box
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
      flexDirection="column"
      position="absolute"
      marginTop={2}
      marginLeft={2}
      width={60}
    >
      <Box marginBottom={1}>
        <Text bold>Add Custom Script (Press ESC to cancel)</Text>
      </Box>

      {step === 'type' && (
        <Box flexDirection="column">
          <Text>Select script type:</Text>
          <Select
            options={typeOptions}
            onChange={value => {
              setScriptType(value);
              setStep('name');
            }}
          />
        </Box>
      )}

      {step === 'name' && (
        <Box flexDirection="column">
          <Text>Enter script name:</Text>
          <TextInput
            placeholder="e.g. clean-build"
            onSubmit={value => {
              if (value.trim()) {
                setScriptName(value.trim());
                setStep('command');
              }
            }}
          />
        </Box>
      )}

      {step === 'command' && (
        <Box flexDirection="column">
          <Text>Enter command:</Text>
          <TextInput
            placeholder="e.g. rm -rf dist && pnpm build"
            onSubmit={value => {
              if (value.trim()) {
                addCustomScript({
                  type: scriptType,
                  name: scriptName,
                  command: value.trim(),
                });
                setActiveModal('none');
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};
