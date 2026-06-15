import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Select } from '@inkjs/ui';

import { discoverDependencies } from '../../core/config-manager/discovery.js';
import { writeConfig } from '../../core/config-manager/io.js';
import { sortTopologically } from '../../core/config-manager/sorter.js';
import type { PackageMetadata } from '../../core/config-manager/types.js';
import { useAppStore } from '../../store/appStore.js';

export const AddDependencyModal = (): React.JSX.Element => {
  const { containerDirs, setActiveModal } = useAppStore();
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [metadatas, setMetadatas] = useState<PackageMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useInput((input, key) => {
    if (key.escape) {
      setActiveModal('none');
    }
  });

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const discovered = await discoverDependencies(containerDirs);
        setMetadatas(discovered);
        const newOptions = discovered.map(m => ({
          label: `${m.name} (${m.version})`,
          value: m.name,
        }));
        setOptions(newOptions);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [containerDirs]);

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={1}
        flexDirection="column"
        position="absolute"
        marginTop={2}
        marginLeft={2}
        width={50}
      >
        <Text>Searching for dependencies...</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      flexDirection="column"
      position="absolute"
      marginTop={2}
      marginLeft={2}
      width={60}
    >
      <Box marginBottom={1}>
        <Text bold>Select a dependency to add (Press ESC to cancel):</Text>
      </Box>
      {options.length > 0 ? (
        <Select
          options={options}
          onChange={newValue => {
            const pkgMap = new Map<string, PackageMetadata>();
            metadatas.forEach(m => pkgMap.set(m.name, m));

            const collected = new Map<string, PackageMetadata>();
            const queue = [newValue];

            while (queue.length > 0) {
              const current = queue.shift()!;
              if (!collected.has(current) && pkgMap.has(current)) {
                const pkg = pkgMap.get(current)!;
                collected.set(current, pkg);
                const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                for (const depName of Object.keys(allDeps)) {
                  if (pkgMap.has(depName)) {
                    queue.push(depName);
                  }
                }
              }
            }

            const sorted = sortTopologically(Array.from(collected.values()));

            useAppStore.setState(state => {
              const existingDeps = new Set(state.dependencies.map(d => d.name));
              const newDeps = sorted
                .filter(p => !existingDeps.has(p.name))
                .map(p => ({
                  name: p.name,
                  type: 'Sync',
                  version: p.version,
                  path: 'unknown',
                  enabled: true,
                }));
              
              const updatedDeps = [...state.dependencies, ...newDeps];
              const depsRecord: Record<string, any> = {};
              updatedDeps.forEach(d => { depsRecord[d.name] = { type: d.type, enabled: d.enabled, version: d.version, path: d.path }; });
              void writeConfig(state.target.cwd, { containers: state.containerDirs, dependencies: depsRecord });

              return {
                dependencies: updatedDeps,
                activeModal: 'none',
              };
            });
          }}
        />
      ) : (
        <Text color="red">No dependencies found in containerDirs.</Text>
      )}
    </Box>
  );
};
