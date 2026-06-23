import { log } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

import { scriptCache } from './script-cache.js';

export interface ScriptAnalysisResult {
  watchScript: string | null;
  buildScript: string | null;
  outDir: string;
}

/**
 * Builds the inference prompt for agy based on the package.json and configuration files.
 */
export async function buildAgyPrompt(
  packageName: string,
  packageJson: any,
  tsconfigs: { fileName: string; content: string }[],
  bundlerConfigs: { fileName: string; content: string }[]
): Promise<string> {
  const simplifiedPackageJson = {
    name: packageJson.name,
    scripts: packageJson.scripts || {},
    dependencies: packageJson.dependencies
      ? Object.keys(packageJson.dependencies)
      : [],
    devDependencies: packageJson.devDependencies
      ? Object.keys(packageJson.devDependencies)
      : [],
  };
  const packageJsonContent = JSON.stringify(simplifiedPackageJson, null, 2);

  let prompt = `You are an expert package configuration and build analyzer for JavaScript/TypeScript.
Your goal is to deduce the optimal build command (\`buildScript\`), watch/live compile command (\`watchScript\`), and final output directory (\`outDir\`) for a local dependency based exclusively on its configuration files.

Strictly follow this internal reasoning:
1. Scan the package.json scripts to detect compilation/build tasks (avoid web dev servers).
2. Determine the "outDir" by cross-referencing tsconfig files, webpack/vite configs, and the package.json "main"/"module" fields.
3. If the build script uses TypeScript but there is no explicit watch script, return null for "watchScript" (NodePi will handle native fallback with tsc).

---
PACKAGE DATA:
Name: ${packageName}

<package_json>
${packageJsonContent}
</package_json>
`;

  if (tsconfigs.length > 0) {
    prompt += `\n<typescript_configurations>\n`;
    for (const conf of tsconfigs) {
      prompt += `File: ${conf.fileName}\nContent:\n${conf.content}\n---\n`;
    }
    prompt += `</typescript_configurations>\n`;
  }

  if (bundlerConfigs.length > 0) {
    prompt += `\n<bundler_configurations>\n`;
    for (const conf of bundlerConfigs) {
      prompt += `File: ${conf.fileName}\nContent:\n${conf.content}\n---\n`;
    }
    prompt += `</bundler_configurations>\n`;
  }

  prompt += `---

Respond ONLY with a JSON code block enclosed in triple backticks (\`\`\`json ... \`\`\`) with the following structure:

\`\`\`json
{
  "buildScript": "script_name_or_null",
  "watchScript": "script_name_or_null",
  "outDir": "relative_path_to_output_directory"
}
\`\`\`

Do not add any explanatory text before or after the JSON block.`;

  return prompt;
}

/**
 * Extracts and parses a JSON block from the agy string output.
 */
export function parseAgyResponse(response: string): ScriptAnalysisResult {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = response.match(jsonRegex);
  const jsonString = match ? match[1] : response;

  try {
    const parsed = JSON.parse(jsonString.trim());
    return {
      buildScript:
        parsed.buildScript === 'null' || parsed.buildScript === null
          ? null
          : String(parsed.buildScript),
      watchScript:
        parsed.watchScript === 'null' || parsed.watchScript === null
          ? null
          : String(parsed.watchScript),
      outDir: parsed.outDir ? String(parsed.outDir) : '.',
    };
  } catch (err: any) {
    throw new Error(
      `Failed to parse JSON response from the AI: ${err.message}. Original response: ${response}`,
      { cause: err }
    );
  }
}

/**
 * Validates the inference result against the package.json scripts (Hallucination Guard).
 */
export function validateAnalysisResult(
  result: ScriptAnalysisResult,
  packageJson: any
): ScriptAnalysisResult {
  const scripts = packageJson.scripts || {};

  let buildScript = result.buildScript;
  if (buildScript && !scripts[buildScript]) {
    buildScript = null; // Hallucination caught
  }

  let watchScript = result.watchScript;
  if (watchScript && !scripts[watchScript]) {
    watchScript = null; // Hallucination caught
  }

  let outDir = result.outDir ? result.outDir.trim() : '.';
  if (!outDir || outDir === '/') {
    outDir = '.';
  }

  return {
    buildScript,
    watchScript,
    outDir,
  };
}

/**
 * Resolves the build and watch scripts + output directory for a local package.
 * Implements caching, AI inference with agy, hallucination guards, and TSC watch fallback.
 */
export async function resolveBuildAndWatch(
  packagePath: string,
  packageJson: any,
  hasAgy: boolean,
  promptFallback?: () => Promise<ScriptAnalysisResult>
): Promise<ScriptAnalysisResult> {
  // 1. Try Cache First
  const cached = await scriptCache.get(packagePath, packageJson);
  if (cached) {
    return cached;
  }

  // 2. Discover configuration files to build prompt context
  let files: string[] = [];
  try {
    files = await fs.readdir(packagePath);
  } catch {
    // Ignore read errors
    void 0;
  }

  const tsconfigFiles = files.filter(
    f => f.startsWith('tsconfig') && f.endsWith('.json')
  );
  const bundlerFiles = files.filter(
    f =>
      f === '.swcrc' ||
      f.startsWith('vite.config') ||
      f.startsWith('webpack.config') ||
      f.startsWith('rollup.config') ||
      f.startsWith('babel.config') ||
      f.startsWith('vue.config')
  );

  const tsconfigs = [];
  for (const f of tsconfigFiles) {
    try {
      const content = await fs.readFile(path.join(packagePath, f), 'utf-8');
      tsconfigs.push({ fileName: f, content });
    } catch {
      // Ignore read errors
      void 0;
    }
  }

  const bundlerConfigs = [];
  for (const f of bundlerFiles) {
    try {
      const content = await fs.readFile(path.join(packagePath, f), 'utf-8');
      bundlerConfigs.push({ fileName: f, content });
    } catch {
      // Ignore read errors
      void 0;
    }
  }

  let result: ScriptAnalysisResult;

  if (hasAgy) {
    const prompt = await buildAgyPrompt(
      packageJson.name || 'library',
      packageJson,
      tsconfigs,
      bundlerConfigs
    );

    try {
      // 3. Invoke agy with 45-second timeout
      const pkgName = packageJson.name || 'library';
      console.log(`\n[NodePi] Invoking agy for ${pkgName}:`);
      console.log(
        `$ agy --model gemini-3.5-flash --print "<prompt>" --print-timeout 45s --dangerously-skip-permissions`
      );

      const { stdout } = await execa(
        'agy',
        [
          '--model',
          'gemini-3.5-flash',
          '--print-timeout',
          '45s',
          '--dangerously-skip-permissions',
          '--print',
          prompt,
        ],
        {
          timeout: 45000,
          env: process.env,
          stdin: 'ignore',
        }
      );

      console.log(`\n[NodePi] agy output for ${pkgName}:`);
      console.log(stdout);

      const parsed = parseAgyResponse(stdout);
      result = validateAnalysisResult(parsed, packageJson);
    } catch (err: any) {
      const pkgName = packageJson.name || 'library';
      log.error(`[NodePi] agy call failed for ${pkgName}: ${err.message}`);
      if (err.stderr) {
        console.error(pc.red(`\n[agy stderr for ${pkgName}]:\n${err.stderr}`));
      }
      if (err.stdout) {
        console.error(
          pc.yellow(`\n[agy stdout for ${pkgName}]:\n${err.stdout}`)
        );
      }
      process.exit(1);
      return undefined as any;
    }
  } else {
    // 4. Fallback on AI failure / timeout or when agy is not installed
    if (promptFallback) {
      result = await promptFallback();
    } else {
      // Safe default heuristics: no build/watch, root output directory
      result = {
        buildScript: null,
        watchScript: null,
        outDir: '.',
      };
    }
  }

  // 5. TSC Watch Auto-Fallback Heuristic
  // If the package is TypeScript (has tsconfig files) and watchScript is null,
  // NodePi automatically runs compiler in watch mode natively
  if (!result.watchScript && tsconfigFiles.length > 0) {
    const hasTsconfigBuild = tsconfigFiles.includes('tsconfig.build.json');
    const hasTsconfig = tsconfigFiles.includes('tsconfig.json');
    if (hasTsconfigBuild) {
      result.watchScript = 'tsc -w -p ./tsconfig.build.json';
    } else if (hasTsconfig) {
      result.watchScript = 'tsc -w -p ./tsconfig.json';
    } else if (tsconfigFiles[0]) {
      result.watchScript = `tsc -w -p ./${tsconfigFiles[0]}`;
    }
  }

  // 6. Cache the validated result
  await scriptCache.set(packagePath, packageJson, result);

  return result;
}
