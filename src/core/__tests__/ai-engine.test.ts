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
  let consoleLogSpy: any;

  beforeEach(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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
    consoleLogSpy.mockRestore();
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

      expect(prompt).toContain('Name: my-lib');
      expect(prompt).toContain('<package_json>');
      expect(prompt).toContain('"build": "tsc"');
      expect(prompt).toContain('<typescript_configurations>');
      expect(prompt).toContain('tsconfig.json');
      expect(prompt).toContain('{"compilerOptions":{}}');
      expect(prompt).toContain('<bundler_configurations>');
      expect(prompt).toContain('vite.config.ts');
      expect(prompt).toContain('export default {}');
    });

    test('should include dependencies and devDependencies in prompt if present', async () => {
      const packageJson = {
        name: 'my-lib',
        scripts: {},
        dependencies: { lodash: '^4.17.21' },
        devDependencies: { typescript: '^5.0.0' },
      };

      const prompt = await buildAgyPrompt('my-lib', packageJson, [], []);
      expect(prompt).toContain('"dependencies": [\n    "lodash"\n  ]');
      expect(prompt).toContain('"devDependencies": [\n    "typescript"\n  ]');
    });

    test('should fallback to empty scripts object if packageJson.scripts is missing', async () => {
      const packageJson = {
        name: 'my-lib',
        // No scripts key
      };

      const prompt = await buildAgyPrompt('my-lib', packageJson, [], []);
      expect(prompt).toContain('"scripts": {}');
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

    test('should map string "null" to actual null for buildScript and watchScript', () => {
      const response = `{
        "buildScript": "null",
        "watchScript": "null",
        "outDir": "dist"
      }`;

      const result = parseAgyResponse(response);
      expect(result.buildScript).toBeNull();
      expect(result.watchScript).toBeNull();
    });

    test('should fallback to dot if outDir is missing/falsy in response', () => {
      const response = `{
        "buildScript": "build",
        "watchScript": null
      }`;

      const result = parseAgyResponse(response);
      expect(result.outDir).toBe('.');
    });

    test('should throw error on invalid JSON', () => {
      const response = 'not a json';
      expect(() => parseAgyResponse(response)).toThrow();
    });
  });

  describe('validateAnalysisResult (Hallucination Guard)', () => {
    test('should default to empty scripts object if packageJson.scripts is missing', () => {
      const packageJson = {}; // no scripts
      const result: ScriptAnalysisResult = {
        buildScript: 'build',
        watchScript: null,
        outDir: 'dist',
      };

      const validated = validateAnalysisResult(result, packageJson);
      // Since scripts is missing, "build" is considered a hallucination and is set to null
      expect(validated.buildScript).toBeNull();
    });

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

    test('should default outDir to dot if it is /', () => {
      const packageJson = { scripts: {} };
      const result: ScriptAnalysisResult = {
        buildScript: null,
        watchScript: null,
        outDir: '/',
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

    test('should exit process with code 1 if agy fails and hasAgy is true (with stdout/stderr logs)', async () => {
      // Mock agy throwing error with stdout/stderr properties
      const rejectErr = new Error(
        'Command timed out after 45000 milliseconds'
      ) as any;
      rejectErr.stdout = 'agy stdout error details';
      rejectErr.stderr = 'agy stderr error details';
      vi.mocked(execa).mockRejectedValue(rejectErr);

      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      await resolveBuildAndWatch(tempDir, pkgJson, true);

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('should exit process with code 1 if agy fails and hasAgy is true (without stdout/stderr logs and with default library name)', async () => {
      // Mock agy throwing clean error
      vi.mocked(execa).mockRejectedValue(new Error('Simple exec error'));

      const pkgJson = {
        // No name
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

      const result = await resolveBuildAndWatch(
        tempDir,
        pkgJson,
        false,
        fallbackMock
      );

      expect(execa).not.toHaveBeenCalled();
      expect(fallbackMock).toHaveBeenCalled();
      expect(result.buildScript).toBe('build-fallback');
    });

    test('should fallback to safe heuristics if hasAgy is false and no promptFallback is provided', async () => {
      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      const result = await resolveBuildAndWatch(tempDir, pkgJson, false);
      expect(result).toEqual({
        buildScript: null,
        watchScript: null,
        outDir: '.',
      });
    });

    test('should fallback to tsc -w -p ./tsconfig.json if tsconfig.json is present and watch is null', async () => {
      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');

      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      const result = await resolveBuildAndWatch(tempDir, pkgJson, false);
      expect(result.watchScript).toBe('tsc -w -p ./tsconfig.json');
    });

    test('should fallback to first custom tsconfig found if no tsconfig.json/build exists', async () => {
      await fs.writeFile(path.join(tempDir, 'tsconfig.custom.json'), '{}');

      const pkgJson = {
        name: 'my-lib',
        scripts: {
          build: 'tsc',
        },
      };

      const result = await resolveBuildAndWatch(tempDir, pkgJson, false);
      expect(result.watchScript).toBe('tsc -w -p ./tsconfig.custom.json');
    });

    test('should read config and bundler files successfully during prompt building', async () => {
      await fs.writeFile(
        path.join(tempDir, 'tsconfig.json'),
        '{"compilerOptions":{}}'
      );
      await fs.writeFile(
        path.join(tempDir, 'vite.config.ts'),
        'export default {}'
      );

      const pkgJson = { name: 'my-lib', scripts: {} };
      // Run resolution (calling resolveBuildAndWatch which builds prompt under the hood if hasAgy = true)
      vi.mocked(execa).mockResolvedValue({
        stdout: '{"buildScript":"build","watchScript":null,"outDir":"dist"}',
      } as any);

      await resolveBuildAndWatch(tempDir, pkgJson, true);
      expect(execa).toHaveBeenCalled();
    });

    test('should handle read errors for config and bundler files gracefully', async () => {
      // Create tsconfig.json and vite.config.ts as folders to force fs.readFile throw EISDIR
      await fs.mkdir(path.join(tempDir, 'tsconfig.json'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'vite.config.ts'), { recursive: true });

      const pkgJson = { name: 'my-lib', scripts: {} };
      vi.mocked(execa).mockResolvedValue({
        stdout: '{"buildScript":"build","watchScript":null,"outDir":"dist"}',
      } as any);

      await expect(
        resolveBuildAndWatch(tempDir, pkgJson, true)
      ).resolves.not.toThrow();
    });

    test('should handle directory read error in resolveBuildAndWatch gracefully', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist-dir');
      const pkgJson = { name: 'my-lib', scripts: {} };
      vi.mocked(execa).mockResolvedValue({
        stdout: '{"buildScript":"build","watchScript":null,"outDir":"dist"}',
      } as any);

      // Should not throw, should handle directory read error internally
      await expect(
        resolveBuildAndWatch(nonExistentDir, pkgJson, true)
      ).resolves.not.toThrow();
    });
  });
});
