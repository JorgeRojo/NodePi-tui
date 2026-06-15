import fs from 'fs/promises';
import path from 'path';

export async function injectViteWrapper(targetCwd: string): Promise<void> {
  const pkgPath = path.join(targetCwd, 'package.json');

  const pkgContent = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgContent) as Record<string, unknown>;

  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Invalid package.json format');
  }

  pkg['injected'] = true;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');

  const possibleConfigs = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ];

  let existingConfig = '';
  for (const config of possibleConfigs) {
    try {
      await fs.access(path.join(targetCwd, config));
      existingConfig = config;
      break;
    } catch {
      // Continue checking next possible config
    }
  }

  let wrapperContent: string;
  if (existingConfig) {
    // ESM import needs the explicit extension if required by Node, but Vite handles extensions automatically in its config resolution.
    // However, to be perfectly safe with TS NodeNext, we might want to include the extension, but Vite actually prefers resolving it itself.
    // For safety, we just import the exact file found.
    wrapperContent = `import { defineConfig, mergeConfig } from 'vite';
import userConfig from './${existingConfig}';

export default mergeConfig(
  userConfig,
  defineConfig({
    optimizeDeps: {
      force: true
    }
  })
);
`;
  } else {
    wrapperContent = `import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    force: true
  }
});
`;
  }

  const viteWrapperPath = path.join(targetCwd, '.vite.config.nodepi.ts');
  await fs.writeFile(viteWrapperPath, wrapperContent, 'utf8');
}
