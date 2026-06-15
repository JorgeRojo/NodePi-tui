import React from 'react';
import { Box, Text, useInput } from 'ink';

import { useAppStore } from '../../store/appStore.js';

export const DependencyList = (): React.JSX.Element => {
  const {
    dependencies,
    focusedDependencyIndex,
    setFocusedDependencyIndex,
    activeModal,
    setActiveModal,
    toggleDependency,
    toggleDependencyMode,
    removeDependency,
  } = useAppStore();

  useInput((input, key) => {
    if (activeModal !== 'none') return;

    if (key.upArrow) {
      setFocusedDependencyIndex(Math.max(0, focusedDependencyIndex - 1));
    }
    if (key.downArrow) {
      setFocusedDependencyIndex(
        Math.min(dependencies.length - 1, focusedDependencyIndex + 1)
      );
    }

    if (input === 't') {
      const dep = dependencies[focusedDependencyIndex];
      if (dep) toggleDependency(dep.name);
    }
    if (input === 'm') {
      const dep = dependencies[focusedDependencyIndex];
      if (dep) toggleDependencyMode(dep.name);
    }
    if (input === 'x') {
      const dep = dependencies[focusedDependencyIndex];
      if (dep) removeDependency(dep.name);
    }
    if (input === 'a') {
      setActiveModal('add');
    }
    if (input === 'c') {
      setActiveModal('config');
    }
    if (input === 'S') {
      setActiveModal('scripts');
    }
  });

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
          <Text
            color={
              idx === focusedDependencyIndex
                ? 'blueBright'
                : dep.enabled
                  ? undefined
                  : 'gray'
            }
          >
            {idx === focusedDependencyIndex ? '▶ ' : '  '}[
            {dep.enabled ? (
              <Text
                color={idx === focusedDependencyIndex ? 'greenBright' : 'green'}
              >
                Enabled
              </Text>
            ) : (
              <Text color="gray">Disabled</Text>
            )}
            ] {dep.name}{' '}
            <Text dimColor>
              ({dep.type}) {dep.version}
            </Text>{' '}
            {dep.path}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray">
          [a] Add Dep [t] Toggle [m] Mode [x] Del [S] Scripts
        </Text>
      </Box>
    </Box>
  );
};
