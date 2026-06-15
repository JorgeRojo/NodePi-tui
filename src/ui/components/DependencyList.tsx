import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const DependencyList = (): React.JSX.Element => {
  const dependencies = useAppStore(state => state.dependencies);

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingX={1}
      minHeight={6}
    >
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text color="gray"> Local Dependencies </Text>
      </Box>
      {dependencies.map((dep, idx) => (
        <Box key={idx}>
          <Text color={idx === 0 ? 'blueBright' : undefined}>
            {idx === 0 ? '▶ ' : '  '}[
            {dep.enabled ? (
              <Text color="green">Enabled</Text>
            ) : (
              <Text color="gray">Disabled</Text>
            )}
            ] {dep.name} ({dep.type}) {dep.version} {dep.path}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray">[a] Add Dep [t] Toggle [m] Mode [x] Del</Text>
      </Box>
    </Box>
  );
};
