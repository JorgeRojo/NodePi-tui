import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const TargetPanel = (): React.JSX.Element => {
  const target = useAppStore(state => state.target);

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingX={1}
    >
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text color="gray">
          {' '}
          Target: {target.name} [{target.branch}]{' '}
        </Text>
      </Box>
      <Text>Version: {target.version}</Text>
      <Text>Selected Dev Script: {target.devScript}</Text>
    </Box>
  );
};
