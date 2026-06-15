import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const Header = (): React.JSX.Element => {
  const pipelineStatus = useAppStore(state => state.pipelineStatus);

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text bold color="white">
        NodePi v1.0.0
      </Text>
      {pipelineStatus === 'running' && (
        <Text bold color="green">
          ▶ Running
        </Text>
      )}
      {pipelineStatus === 'error' && (
        <Text bold color="red">
          ✖ Error
        </Text>
      )}
    </Box>
  );
};
