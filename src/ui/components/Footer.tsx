import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const Footer = (): React.JSX.Element => {
  const { target } = useAppStore(state => state);

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text color="gray">
        CWD: {target.cwd} | Branch: {target.branch}
      </Text>
      <Text bold>
        [r] Run [f] Force Run [s] Stop [a] Add Dep [c] Config [S] Scripts [q]
        Quit
      </Text>
    </Box>
  );
};
