import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const LogsPanel = (): React.JSX.Element => {
  const logs = useAppStore(state => state.logs);

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingX={1}
      flexGrow={1}
    >
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text color="gray"> Console Logs </Text>
      </Box>
      {logs.map((log, idx) => (
        <Box key={idx}>
          <Text color={log.color}>▍ </Text>
          <Text color="gray">{log.prefix} </Text>
          <Text>{log.message}</Text>
        </Box>
      ))}
    </Box>
  );
};
