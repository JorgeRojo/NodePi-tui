import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Select } from '@inkjs/ui';

import { useAppStore } from '../../store/appStore.js';

export const ConfigModal = (): React.JSX.Element | null => {
  const { dependencies, focusedDependencyIndex, setActiveModal } =
    useAppStore();
  const dep = dependencies[focusedDependencyIndex];

  useInput((input, key) => {
    if (key.escape) {
      setActiveModal('none');
    }
  });

  if (!dep) return null;

  return (
    <Box
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      flexDirection="column"
      position="absolute"
      marginTop={2}
      marginLeft={2}
      width={50}
    >
      <Box marginBottom={1}>
        <Text bold>Configure {dep.name} (Press ESC to cancel):</Text>
      </Box>
      <Text>Select override script:</Text>
      <Select
        options={[
          { label: 'npm run build', value: 'npm run build' },
          { label: 'npm run dev', value: 'npm run dev' },
          { label: 'npm run watch', value: 'npm run watch' },
          { label: 'None', value: 'none' },
        ]}
        onChange={() => {
          // In a real implementation we would update the script
          setActiveModal('none');
        }}
      />
    </Box>
  );
};
