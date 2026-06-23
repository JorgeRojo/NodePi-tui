import { log } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';

export interface ScriptStep {
  command: string;
  description: string;
}

export interface ProjectValidationResult {
  isValid: boolean;
  packageManager: 'yarn' | 'pnpm' | 'npm';
  projectType: 'bundle-interface-module' | 'standard-vite' | 'other';
  scriptSequence: ScriptStep[];
  warnings: string[];
  error?: string;
}

/**
 * Helper function to build package-manager script run commands.
 */
function getRunCommand(
  packageManager: 'yarn' | 'pnpm' | 'npm',
  scriptName: string
): string {
  if (packageManager === 'npm') {
    return `npm run ${scriptName}`;
  }
  return `${packageManager} ${scriptName}`;
}

/**
 * Validates a project inside the specified target path and computes
 * the sequence of scripts the user should execute to run/build it.
 */
export async function validateProject(
  targetDir: string,
  hasAgy: boolean
): Promise<ProjectValidationResult> {
  const packageJsonPath = path.join(targetDir, 'package.json');

  try {
    const stat = await fs.stat(packageJsonPath);
    if (!stat.isFile()) {
      return {
        isValid: false,
        packageManager: 'npm',
        projectType: 'other',
        scriptSequence: [],
        warnings: [],
        error: `Could not find package.json in directory: ${targetDir}`,
      };
    }
  } catch {
    return {
      isValid: false,
      packageManager: 'npm',
      projectType: 'other',
      scriptSequence: [],
      warnings: [],
      error: `Could not find package.json in directory: ${targetDir}`,
    };
  }

  // 1. Read files in target directory and load package.json
  let files: string[] = [];
  try {
    files = await fs.readdir(targetDir);
  } catch {
    void 0;
  }

  let packageJson: Record<string, unknown>;
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content) as Record<string, unknown>;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      packageManager: 'npm',
      projectType: 'other',
      scriptSequence: [],
      warnings: [],
      error: `Error reading or parsing package.json: ${errMsg}`,
    };
  }

  // 2. Determine Package Manager
  let packageManager: 'yarn' | 'pnpm' | 'npm' = 'npm';
  if (files.includes('yarn.lock')) {
    packageManager = 'yarn';
  } else if (files.includes('pnpm-lock.yaml')) {
    packageManager = 'pnpm';
  } else if (files.includes('package-lock.json')) {
    packageManager = 'npm';
  }

  const warnings: string[] = [];

  // Add Lockfile collision warning if Yarn is used (since NodePi is package-manager agnostic but rsyncs node_modules)
  if (packageManager === 'yarn') {
    warnings.push(
      'This project uses Yarn (yarn.lock). NodePi functions agnostically by syncing files in node_modules, but make sure to perform the initial installation with Yarn to avoid conflicts.'
    );
  }

  // Check for RedPoints private registry warning
  const dependencies = (packageJson.dependencies || {}) as Record<
    string,
    string
  >;
  const devDependencies = (packageJson.devDependencies || {}) as Record<
    string,
    string
  >;
  const hasRedpointsDeps = Object.keys(dependencies)
    .concat(Object.keys(devDependencies))
    .some(dep => dep.startsWith('redpoints-') || dep.startsWith('@redpoints'));

  if (hasRedpointsDeps) {
    warnings.push(
      'RedPoints dependencies detected. Make sure to configure access to the private registry (Nexus) before installing dependencies.'
    );
  }

  const scripts = (packageJson.scripts || {}) as Record<string, string>;

  // 3. AI-driven sequence resolution if hasAgy is true
  if (hasAgy) {
    try {
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

      const prompt = `You are an expert development assistant specializing in local dependency injection and synchronization flows (using NodePi).
Your goal is to deduce the exact terminal commands (scripts) and target project type to prepare/install the local environment before continuing with the injection.

Strictly follow these guidelines for the script sequence:
1. Recommend only the initial commands required to install dependencies and perform preliminary environment setup.
2. The recommended commands in the sequence must exactly match those defined in the package.json, without adding environment variable prefixes or altering their syntax.
3. Exclude completely any commands meant to compile the project or start development servers.
4. Identify and include key warnings in "warnings" regarding required environment variables, network/VPN, local hosts, certificates, or any critical prerequisites to configure the environment.

---
TARGET PROJECT DATA:
Name: ${packageJson.name || 'project'}
Root files: ${files.join(', ')}

<package_json>
${JSON.stringify(simplifiedPackageJson, null, 2)}
</package_json>
---

Respond ONLY with a JSON code block enclosed in triple backticks (\`\`\`json ... \`\`\`) with the following structure:

\`\`\`json
{
  "projectType": "standard-vite" | "bundle-interface-module" | "other",
  "sequence": [
    {
      "command": "console_command",
      "description": "1-line description of what this command does"
    }
  ],
  "warnings": [
    "relevant_warning_1"
  ]
}
\`\`\`

Do not add any explanatory text before or after the JSON block.`;

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

      const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = stdout.match(jsonRegex);
      const jsonString = match ? match[1] : stdout;
      const parsed = JSON.parse(jsonString.trim()) as {
        projectType: 'bundle-interface-module' | 'standard-vite' | 'other';
        sequence: ScriptStep[];
        warnings?: string[];
      };

      if (parsed && Array.isArray(parsed.sequence)) {
        if (parsed.warnings && Array.isArray(parsed.warnings)) {
          for (const w of parsed.warnings) {
            warnings.push(String(w));
          }
        }

        let sequence = parsed.sequence.filter(step => {
          const cmd = step.command.trim().toLowerCase();
          const isBlacklisted =
            cmd.includes('start') ||
            cmd.includes('dev') ||
            cmd.includes('build') ||
            cmd.includes('watch') ||
            cmd.includes('test') ||
            cmd.includes('lint') ||
            cmd.includes('format') ||
            cmd.includes('prettier');
          return !isBlacklisted;
        });

        if (scripts['setup']) {
          sequence = [
            {
              command: getRunCommand(packageManager, 'setup'),
              description:
                'Initializes and configures the project for development (includes all necessary preparation and installation logic).',
            },
          ];
        }

        return {
          isValid: true,
          packageManager,
          projectType: parsed.projectType || 'other',
          scriptSequence: sequence,
          warnings,
        };
      }
    } catch (err: any) {
      log.error(
        `[NodePi] agy call failed when analyzing target project structure: ${err.message}`
      );
      if (err.stderr) {
        console.error(pc.red(`\n[agy stderr]:\n${err.stderr}`));
      }
      if (err.stdout) {
        console.error(pc.yellow(`\n[agy stdout]:\n${err.stdout}`));
      }
      process.exit(1);
      return undefined as any;
    }
  }

  // 4. Deterministic validation fallback (when hasAgy is false)
  // Type A: bundle-interface-module
  const isBundleInterfaceModule =
    Boolean(devDependencies['redpoints-front-bundle-interface-rp10']) ||
    Boolean(dependencies['redpoints-front-bundle-interface-rp10']) ||
    Boolean(scripts['install-devApp']);

  if (isBundleInterfaceModule) {
    const installCmd = scripts['install:dependencies']
      ? getRunCommand(packageManager, 'install:dependencies')
      : `${packageManager} install`;
    const sequence: ScriptStep[] = [
      {
        command: installCmd,
        description:
          'Installs local dependencies and initializes the isolated environment using install-devApp.',
      },
    ];

    if (scripts['conf']) {
      sequence.push({
        command: getRunCommand(packageManager, 'conf'),
        description:
          'Downloads the testing environment configurations (Portal APIs).',
      });
    }

    return {
      isValid: true,
      packageManager,
      projectType: 'bundle-interface-module',
      scriptSequence: sequence,
      warnings,
    };
  }

  // Type B: standard-vite
  const isViteProject =
    files.some(f => f.startsWith('vite.config')) ||
    Boolean(dependencies['vite']) ||
    Boolean(devDependencies['vite']);

  if (isViteProject) {
    const sequence: ScriptStep[] = [];

    if (scripts['setup']) {
      sequence.push({
        command: getRunCommand(packageManager, 'setup'),
        description: 'Initializes and configures the project for development.',
      });
    } else {
      const installCmd = scripts['install:dependencies']
        ? getRunCommand(packageManager, 'install:dependencies')
        : `${packageManager} install`;
      sequence.push({
        command: installCmd,
        description: 'Installs the project dependencies.',
      });

      if (scripts['conf']) {
        sequence.push({
          command: getRunCommand(packageManager, 'conf'),
          description: 'Downloads the development API configurations.',
        });
      }
    }

    return {
      isValid: true,
      packageManager,
      projectType: 'standard-vite',
      scriptSequence: sequence,
      warnings,
    };
  }

  // Programmatic fallback for 'other'
  const fallbackSequence: ScriptStep[] = [];

  if (scripts['setup']) {
    fallbackSequence.push({
      command: getRunCommand(packageManager, 'setup'),
      description: 'Initializes and configures the project.',
    });
  } else {
    const installCmd = scripts['install:dependencies']
      ? getRunCommand(packageManager, 'install:dependencies')
      : `${packageManager} install`;
    fallbackSequence.push({
      command: installCmd,
      description: 'Installs the project dependencies.',
    });

    if (scripts['conf']) {
      fallbackSequence.push({
        command: getRunCommand(packageManager, 'conf'),
        description: 'Downloads the development API configurations.',
      });
    }
  }

  return {
    isValid: true,
    packageManager,
    projectType: 'other',
    scriptSequence: fallbackSequence,
    warnings,
  };
}
