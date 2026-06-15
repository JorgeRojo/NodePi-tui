import React from 'react';
import { Box, Text } from 'ink';

export const Header = (): React.JSX.Element => {
  return (
    <Box paddingX={1}>
      <Text bold color="white">
        NodePi v1.0.0
      </Text>
    </Box>
  );
};
