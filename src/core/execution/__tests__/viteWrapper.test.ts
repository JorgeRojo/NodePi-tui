import type { Mock } from 'vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs/promises';
import path from 'path';

import { injectViteWrapper } from '../viteWrapper.js';

vi.mock('fs/promises');

describe('injectViteWrapper', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should inject "injected": true into package.json and generate basic Vite config if none exists', async () => {
    const targetCwd = '/target/dir';
    const pkgPath = path.join(targetCwd, 'package.json');
    const viteConfigPath = path.join(targetCwd, '.vite.config.nodepi.ts');

    const originalPkg = { name: 'test-app', version: '1.0.0' };

    (fs.readFile as Mock).mockResolvedValueOnce(JSON.stringify(originalPkg));
    (fs.access as Mock).mockRejectedValue(new Error('ENOENT')); // no existing config

    await injectViteWrapper(targetCwd);

    expect(fs.readFile).toHaveBeenCalledWith(pkgPath, 'utf8');

    const expectedPkg = { ...originalPkg, injected: true };
    expect(fs.writeFile).toHaveBeenCalledWith(
      pkgPath,
      JSON.stringify(expectedPkg, null, 2),
      'utf8'
    );

    const expectedConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    force: true
  }
});
`;
    expect(fs.writeFile).toHaveBeenCalledWith(
      viteConfigPath,
      expectedConfig,
      'utf8'
    );
  });

  it('should merge with existing vite.config.js if it exists', async () => {
    const targetCwd = '/target/dir';
    const originalPkg = { name: 'test-app' };

    (fs.readFile as Mock).mockResolvedValueOnce(JSON.stringify(originalPkg));

    // access is called for possibleConfigs in order:
    // vite.config.ts, vite.config.js, vite.config.mjs, vite.config.cjs
    (fs.access as Mock).mockImplementation(async (filePath: string) => {
      if (filePath.endsWith('vite.config.js')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('ENOENT'));
    });

    await injectViteWrapper(targetCwd);

    const viteConfigPath = path.join(targetCwd, '.vite.config.nodepi.ts');
    const expectedConfig = `import { defineConfig, mergeConfig } from 'vite';
import userConfig from './vite.config.js';

export default mergeConfig(
  userConfig,
  defineConfig({
    optimizeDeps: {
      force: true
    }
  })
);
`;
    expect(fs.writeFile).toHaveBeenCalledWith(
      viteConfigPath,
      expectedConfig,
      'utf8'
    );
  });

  it('should throw an error if package.json is invalid json', async () => {
    const targetCwd = '/target/dir';
    (fs.readFile as Mock).mockResolvedValueOnce('invalid json');

    await expect(injectViteWrapper(targetCwd)).rejects.toThrow();
  });

  it('should throw an error if package.json does not parse to an object', async () => {
    const targetCwd = '/target/dir';
    (fs.readFile as Mock).mockResolvedValueOnce('"string-not-object"');

    await expect(injectViteWrapper(targetCwd)).rejects.toThrow(
      'Invalid package.json format'
    );
  });
});
