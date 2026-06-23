import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs/promises';

import { validateProject } from '../project-validator.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('Project Validator', () => {
  let exitSpy: any;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    vi.clearAllMocks();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  test('should fail if package.json is missing', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Could not find package.json');
  });

  test('should detect Yarn project programmatically', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([
      'package.json',
      'yarn.lock',
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'test-project',
        dependencies: {
          vite: '^4.0.0',
        },
        scripts: {
          dev: 'vite',
          build: 'vite build',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.packageManager).toBe('yarn');
    expect(result.projectType).toBe('standard-vite');
    expect(result.scriptSequence).toEqual([
      {
        command: 'yarn install',
        description: 'Installs the project dependencies.',
      },
    ]);
  });

  test('should detect bundle-interface-module programmatically', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([
      'package.json',
      'yarn.lock',
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'redpoints-front-documents-rp10',
        devDependencies: {
          'redpoints-front-bundle-interface-rp10': '^1.0.0',
        },
        scripts: {
          'install-devApp': 'node build-app.js',
          'install:dependencies': 'yarn install && yarn install-devApp',
          conf: 'yarn get-config',
          start: 'vite',
          dist: 'yarn compile-bundle',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('bundle-interface-module');
    expect(result.scriptSequence).toEqual([
      {
        command: 'yarn install:dependencies',
        description:
          'Installs local dependencies and initializes the isolated environment using install-devApp.',
      },
      {
        command: 'yarn conf',
        description:
          'Downloads the testing environment configurations (Portal APIs).',
      },
    ]);
  });

  test('should call agy successfully for target project validation if hasAgy is true', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'custom-project',
        scripts: {
          start: 'node index.js',
        },
      })
    );

    vi.mocked(execa).mockResolvedValue({
      stdout: `\`\`\`json
{
  "projectType": "standard-vite",
  "sequence": [
    {
      "command": "yarn install",
      "description": "Install dependencies"
    }
  ],
  "warnings": ["Private registry check needed"]
}
\`\`\`
`,
    } as any);

    const result = await validateProject('/test-path', true);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('standard-vite');
    expect(execa).toHaveBeenCalledWith(
      'agy',
      expect.arrayContaining([
        '--print',
        expect.stringContaining(
          'local dependency injection and synchronization'
        ),
        '--print-timeout',
        '45s',
      ]),
      expect.any(Object)
    );
    expect(result.scriptSequence).toEqual([
      {
        command: 'yarn install',
        description: 'Install dependencies',
      },
    ]);
  });

  test('should exit process with code 1 if agy fails and hasAgy is true', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'custom-project',
        scripts: {
          start: 'node index.js',
        },
      })
    );

    vi.mocked(execa).mockRejectedValue(new Error('Agy timed out'));

    await validateProject('/test-path', true);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('should fall back programmatically if hasAgy is false', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'custom-project',
        scripts: {
          start: 'node index.js',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('other');
    expect(result.scriptSequence).toEqual([
      {
        command: 'npm install',
        description: 'Installs the project dependencies.',
      },
    ]);
  });

  test('should fall back programmatically with dev and build scripts if hasAgy is false', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'custom-project',
        scripts: {
          dev: 'vite',
          build: 'vite build',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('other');
    expect(result.scriptSequence).toEqual([
      {
        command: 'npm install',
        description: 'Installs the project dependencies.',
      },
    ]);
  });

  test('should fail if package.json has invalid/corrupted JSON', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue('invalid json content { [');

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Error reading or parsing package.json');
  });

  test('should detect bundle-interface-module with missing optional scripts (conf, dist)', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'redpoints-front-documents-rp10',
        devDependencies: {
          'redpoints-front-bundle-interface-rp10': '^1.0.0',
        },
        scripts: {
          'install-devApp': 'node build-app.js',
          start: 'vite',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('bundle-interface-module');
    expect(result.scriptSequence).toEqual([
      {
        command: 'npm install',
        description:
          'Installs local dependencies and initializes the isolated environment using install-devApp.',
      },
    ]);
  });

  test('should generate warning for RedPoints private dependencies', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([
      'package.json',
      'yarn.lock',
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'my-project',
        dependencies: {
          '@redpoints/ui-lib': '^1.0.0',
          'redpoints-front-translations': '^2.0.0',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(
      'RedPoints dependencies detected. Make sure to configure access to the private registry (Nexus) before installing dependencies.'
    );
  });

  test('should detect setup script in standard-vite project', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([
      'package.json',
      'yarn.lock',
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'redpoints-front-rp10',
        dependencies: {
          vite: '^4.0.0',
        },
        scripts: {
          setup: 'yarn conf && yarn install:dependencies',
          conf: 'yarn get-config',
          start: 'yarn conf && vite',
          build: 'vite build',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.packageManager).toBe('yarn');
    expect(result.projectType).toBe('standard-vite');
    expect(result.scriptSequence).toEqual([
      {
        command: 'yarn setup',
        description: 'Initializes and configures the project for development.',
      },
    ]);
  });

  test('should detect install:dependencies script in standard-vite project when setup is not present', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue([
      'package.json',
      'pnpm-lock.yaml',
    ] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'vite-project',
        dependencies: {
          vite: '^4.0.0',
        },
        scripts: {
          'install:dependencies': 'pnpm install && pnpm build',
          dev: 'vite',
          build: 'vite build',
        },
      })
    );

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(true);
    expect(result.packageManager).toBe('pnpm');
    expect(result.projectType).toBe('standard-vite');
    expect(result.scriptSequence).toEqual([
      {
        command: 'pnpm install:dependencies',
        description: 'Installs the project dependencies.',
      },
    ]);
  });
});
