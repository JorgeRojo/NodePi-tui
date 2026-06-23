import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ScriptAnalysisResult } from '../ai-engine.js';
import {
  buildAgyPrompt,
  parseAgyResponse,
  resolveBuildAndWatch,
  validateAnalysisResult,
} from '../ai-engine.js';
import { scriptCache } from '../script-cache.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
  },
}));

vi.mock('../script-cache.js', () => ({
  scriptCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('AI Inference Engine & Heuristics', () => {
  let tempDir: string;
  let exitSpy: any;

  beforeEach(async () => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    tempDir = path.join(
      os.tmpdir(),
      'nodepi-test-ai-engine-' + Math.random().toString(36).slice(2)
    );
    await fs.mkdir(tempDir, { recursive: true });
    vi.mocked(scriptCache.get).mockResolvedValue(null);
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('buildAgyPrompt', () => {
    test('should include package.json and config file contents in prompt', async () => {
      const packageJson = { name: 'my-lib', scripts: { build: 'tsc' } };
      const tsconfigs = [
        { fileName: 'tsconfig.json', content: '{"compilerOptions":{}}' },
      ];
      const bundlerConfigs = [
        { fileName: 'vite.config.ts', content: 'export default {}' },
      ];

      const prompt = await buildAgyPrompt(
        'my-lib',
        packageJson,
        tsconfigs,
        bundlerConfigs
      );

      expect(prompt).toContain('Nombre: my-lib');
      expect(prompt).toContain('<package_json>');
      expect(prompt).toContain('"build": "tsc"');
      expect(prompt).toContain('<typescript_configurations>');
      expect(prompt).toContain('tsconfig.json');
      expect(prompt).toContain('{"compilerOptions":{}}');
      expect(prompt).toContain('<bundler_configurations>');
      expect(prompt).toContain('vite.config.ts');
      expect(prompt).toContain('export default {}');
    });
  });

  describe('parseAgyResponse', () => {
    test('should extract and parse JSON from markdown code blocks', () => {
      const response = `Here is the response:
\`\`\`json
{
  "buildScript": "build",
  "watchScript": null,
  "outDir": "dist"
}
\`\`\`
Hope this helps!`;

      const result = parseAgyResponse(response);
      expect(result).toEqual({
        buildScript: 'build',
        watchScript: null,
        outDir: 'dist',
      });
    });

    test('should fall back to parsing raw string if markdown code blocks are absent', () => {
      const response = `{
        "buildScript": "build",
        "watchScript": null,
        "outDir": "dist"
      }`;

      const result = parseAgyResponse(response);
      expect(result).toEqual({
        buildScript: 'build',
        watchScript: null,
        outDir: 'dist',
      });
    });

    test('should throw error on invalid JSON', () => {
      const response = 'not a json';
      expect(() => parseAgyResponse(response)).toThrow();
    });
  });

  describe('validateAnalysisResult (Hallucination Guard)', () => {
    test('should keep valid scripts and fallback invalid ones to null', () => {
      const packageJson = {
        scripts: {
          build: 'tsc',
          watch: 'tsc -w',
        },
      };

      const result: ScriptAnalysisResult = {
        buildScript: 'build',
        watchScript: 'invalid-watch-script', // doesn't exist
        outDir: 'dist',
      };

      const validated = validateAnalysisResult(result, packageJson);
      expect(validated.buildScript).toBe('build');
      expect(validated.watchScript).toBeNull();
      expect(validated.outDir).toBe('dist');
    });

    test('should default outDir to dot if empty or invalid', () => {
      const packageJson = { scripts: {} };
      const result: ScriptAnalysisResult = {
        buildScript: null,
        watchScript: null,
        outDir: '',
      };

      const validated = validateAnalysisResult(result, packageJson);
      expect(validated.outDir).toBe('.');
    });
  });

  describe('resolveBuildAndWatch (AI Execution & Fallback)', () => {
    test('should return cached result if cache hit occurs', async () => {
      const cached: ScriptAnalysisResult = {
        buildScript: 'compile',
        watchScript: 'dev',
        outDir: 'lib',
      };
      vi.mocked(scriptCache.get).mockResolvedValue(cached);

      const pkgJson = { name: 'my-lib' };
      const result = await resolveBuildAndWatch(tempDir, pkgJson, true);

      expect(result).toEqual(cached);
      expect(execa).not.toHaveBeenCalled();
    });

    test('should execute agy, parse response, validate, and cache it on cache miss', async () => {
      // Mock agy returning valid markdown JSON
      vi.mocked(execa).mockResolvedValue({
        stdout: `\`\`\`json
{
  "buildScript": "build",
  "watchScript": "watch",
  "outDir": "dist"
}
\`\`\`
`,
      } as any);

      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
          watch: 'tsc -w',
        },
      };

      const result = await resolveBuildAndWatch(tempDir, pkgJson, true);

      expect(result).toEqual({
        buildScript: 'build',
        watchScript: 'watch',
        outDir: 'dist',
      });

      // Verify it called agy --print
      expect(execa).toHaveBeenCalledWith(
        'agy',
        expect.arrayContaining([
          '--print',
          '--print-timeout',
          '45s',
          '--dangerously-skip-permissions',
        ]),
        expect.any(Object)
      );

      // Verify cache set was called
      expect(scriptCache.set).toHaveBeenCalledWith(tempDir, pkgJson, result);
    });

    test('should activate TSC Watch Auto-Fallback for TS packages without watch script', async () => {
      // Mock agy returning build only, watch null
      vi.mocked(execa).mockResolvedValue({
        stdout: `\`\`\`json
{
  "buildScript": "build",
  "watchScript": null,
  "outDir": "dist"
}
\`\`\`
`,
      } as any);

      // Create tsconfig.build.json to trigger TS fallback
      await fs.writeFile(path.join(tempDir, 'tsconfig.build.json'), '{}');

      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      const result = await resolveBuildAndWatch(tempDir, pkgJson, true);

      // Should automatically override watchScript to run tsc compiler natively in watch mode
      expect(result.buildScript).toBe('build');
      expect(result.watchScript).toBe('tsc -w -p ./tsconfig.build.json');
      expect(result.outDir).toBe('dist');
    });

    test('should exit process with code 1 if agy fails and hasAgy is true', async () => {
      // Mock agy throwing error
      vi.mocked(execa).mockRejectedValue(new Error('Command timed out after 45000 milliseconds'));

      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      await resolveBuildAndWatch(tempDir, pkgJson, true);

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('should bypass agy and use fallback / heuristics if hasAgy is false', async () => {
      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      const fallbackMock = vi.fn().mockResolvedValue({
        buildScript: 'build-fallback',
        watchScript: null,
        outDir: 'dist-fallback',
      });

      const result = await resolveBuildAndWatch(tempDir, pkgJson, false, fallbackMock);

      expect(execa).not.toHaveBeenCalled();
      expect(fallbackMock).toHaveBeenCalled();
      expect(result.buildScript).toBe('build-fallback');
    });
  });
});
