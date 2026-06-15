import React from 'react';
import { Box, Text } from 'ink';

import { useAppStore } from '../store/appStore.js';
import { AddDependencyModal } from './components/AddDependencyModal.js';
import { ConfigModal } from './components/ConfigModal.js';
import { DependencyList } from './components/DependencyList.js';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { LogsPanel } from './components/LogsPanel.js';
import { ScriptsModal } from './components/ScriptsModal.js';
import { Sidebar } from './components/Sidebar.js';
import { TargetPanel } from './components/TargetPanel.js';
import { useGlobalKeybindings } from './hooks/useGlobalKeybindings.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';

export const App = (): React.JSX.Element => {
  const { columns, rows } = useTerminalSize();
  const activeModal = useAppStore(state => state.activeModal);

  useGlobalKeybindings();

  if (columns < 80 || rows < 24) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={rows}
      >
        <Text color="yellow" bold>
          ⚠️ Terminal too small!
        </Text>
        <Text>
          Current: {columns}x{rows} | Required: {'>'}= 80x24
        </Text>
        <Text>Please resize your terminal window to resume.</Text>
      </Box>
    );
  }

  const showSidebar = columns >= 100;

  return (
    <Box flexDirection="column" width="100%" height={rows}>
      <Header />
      <Box flexDirection="row" flexGrow={1}>
        <Box
          flexDirection="column"
          flexGrow={1}
          width={showSidebar ? '70%' : '100%'}
        >
          <TargetPanel />
          <DependencyList />
          <LogsPanel />
        </Box>
        {showSidebar && (
          <Box flexDirection="column" width="30%">
            <Sidebar />
          </Box>
        )}
      </Box>
      <Footer />
      {activeModal === 'add' && <AddDependencyModal />}
      {activeModal === 'config' && <ConfigModal />}
      {activeModal === 'scripts' && <ScriptsModal />}
    </Box>
  );
};
