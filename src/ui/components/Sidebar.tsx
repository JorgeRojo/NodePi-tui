import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const Sidebar = (): React.JSX.Element => {
  const { activeProcesses, timeline, containerDirs } = useAppStore(
    state => state
  );

  return (
    <Box flexDirection="column" height="100%">
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color="gray"> Active Processes </Text>
        </Box>
        {activeProcesses.map((proc, idx) => (
          <Box key={idx}>
            <Text color={proc.type === 'DEV' ? 'green' : 'blueBright'}>
              [● {proc.type}] {proc.name} (PID: {proc.pid})
            </Text>
          </Box>
        ))}
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
        flexGrow={1}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color="gray"> Dependency Timeline </Text>
        </Box>
        {timeline.map((event, idx) => (
          <Box key={idx} flexDirection="column">
            <Box>
              <Text color="gray">
                {event.isTarget ? '■' : '●'} {event.name} ({event.role})
              </Text>
            </Box>
            {idx < timeline.length - 1 && (
              <Box flexDirection="column">
                <Text color="gray">▲</Text>
                <Text color="gray">│ {timeline[idx + 1].version}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color="gray"> Container Directories </Text>
        </Box>
        {containerDirs.map((dir, idx) => (
          <Box key={idx}>
            <Text>{dir}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
