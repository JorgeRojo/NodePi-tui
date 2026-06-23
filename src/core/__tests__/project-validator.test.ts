import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs/promises';

import { validateProject } from '../project-validator.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('Project Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should fail if package.json is missing', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

    const result = await validateProject('/test-path', false);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('No se encontró package.json');
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
        description: 'Instala las dependencias del proyecto.',
      },
      {
        command: 'yarn dev',
        description: 'Inicia el servidor de desarrollo de Vite.',
      },
      {
        command: 'yarn build',
        description: 'Compila el proyecto para producción.',
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
          'Instala dependencias locales e inicializa el entorno aislado con install-devApp.',
      },
      {
        command: 'yarn conf',
        description:
          'Descarga las configuraciones del entorno de pruebas (APIs de Portal).',
      },
      {
        command: 'yarn start',
        description: 'Inicia el servidor local de desarrollo de Vite.',
      },
      {
        command: 'yarn dist',
        description: 'Compila y empaqueta el bundle final para producción.',
      },
    ]);
  });

  test('should fall back to agy if project type is non-deterministic and hasAgy is true', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readdir).mockResolvedValue(['package.json'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        name: 'custom-project',
        scripts: {
          custom: 'echo hello',
        },
      })
    );

    const agyResponse = {
      projectType: 'other',
      sequence: [
        {
          command: 'npm run custom',
          description: 'Ejecuta el script customizado.',
        },
      ],
      warnings: ['Agy warning'],
    };

    vi.mocked(execa).mockResolvedValue({
      stdout: '```json\n' + JSON.stringify(agyResponse) + '\n```',
    } as any);

    const result = await validateProject('/test-path', true);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('other');
    expect(result.scriptSequence).toEqual(agyResponse.sequence);
    expect(result.warnings).toContain('Agy warning');
  });

  test('should fall back programmatically if agy fails or is not available', async () => {
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

    vi.mocked(execa).mockRejectedValue(new Error('Agy failed'));

    const result = await validateProject('/test-path', true);
    expect(result.isValid).toBe(true);
    expect(result.projectType).toBe('other');
    expect(result.scriptSequence).toEqual([
      {
        command: 'npm install',
        description: 'Instala las dependencias del proyecto.',
      },
      {
        command: 'npm start',
        description: 'Inicia el servidor de desarrollo.',
      },
    ]);
  });
});
