import {
  confirm,
  log,
  multiselect,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { execa } from 'execa';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import pc from 'picocolors';

import type { ScriptAnalysisResult } from './core/ai-engine.js';
import { resolveBuildAndWatch } from './core/ai-engine.js';
import { backupRestoreManager } from './core/backup-restore.js';
import { configManager } from './core/config.js';
import {
  buildDependencyGraph,
  findIntermediateDependencies,
  scanContainers,
} from './core/discovery.js';
import {
  patchEntrypoint,
  runRsync,
  writeViteWrapper,
} from './core/execution.js';
import { setupExitHandlers } from './core/exit-handler.js';
import { getGitStatus, getVersionMismatch } from './core/git-guard.js';
import { logger } from './core/logger.js';
import { dependencyOrchestrator } from './core/orchestrator.js';
import { runPreflight } from './core/preflight.js';
import { validateProject } from './core/project-validator.js';
/* v8 ignore start */
function resolveDependencyPath(targetDir: string, depName: string): string {
  const directPath = path.join(targetDir, 'node_modules', depName);
  try {
    if (
      fsSync.existsSync(directPath) &&
      fsSync.statSync(directPath).isDirectory()
    ) {
      return directPath;
    }
  } catch {
    // Ignore and fallback
  }

  try {
    const requireInstance = createRequire(path.join(targetDir, 'package.json'));
    const resolvedPackageJson = requireInstance.resolve(
      `${depName}/package.json`
    );
    return path.dirname(resolvedPackageJson);
  } catch {
    return directPath;
  }
}
/* v8 ignore stop */

const banner = `
    ·░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░·       
  ·░░░░░░░░░░█▀█░█▀█░█▀▄░█▀▀░█▀█░▀█▀░░░░░░░░░░·  
··░░░░░░░░░░░█░█░█░█░█░█░█▀▀░█▀▀░░█░░░░░░░░░░░░··
  ·░░░░░░░░░░▀░▀░▀▀▀░▀▀ ░▀▀▀░▀░░░▀▀▀░░░░░░░░░░·  
    ·░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░·    
`;

function colorizeBanner(str: string): string {
  const solidColors = [38, 63, 105, 141, 38]; // Vertical gradient: Slate Blue/Bluish Lilac (63) -> Light Bluish Lilac (105) -> Bright Lilac (141)
  let textLineCounter = 0;

  return str
    .split('\n')
    .map(line => {
      if (line.trim() === '') {
        return line;
      }
      const col = solidColors[textLineCounter % solidColors.length];
      textLineCounter++;

      return line
        .split('')
        .map(char => {
          if (char === '·') {
            return `\x1b[38;5;97m${char}\x1b[0m`; // Medium-dark purple for non-solid blocks
          }
          if (char === '░') {
            return `\x1b[38;5;97m${char}\x1b[0m`; // Medium-dark purple for non-solid blocks
          }
          return `\x1b[38;5;${col}m${char}\x1b[0m`;
        })
        .join('');
    })
    .join('\n');
}

/**
 * Runs the interactive CLI wizard, coordinating all modular preflight, discovery, guard, AI engine,
 * execution, and orchestration steps.
 */
export async function runWizard(): Promise<void> {
  console.clear();
  console.log(colorizeBanner(banner));
  logger.init();
  logger.info('Wizard', 'NodePi CLI wizard started.');

  let preflight;
  try {
    preflight = await runPreflight();
  } catch (error: any) {
    log.error(`Fatal preflight error: ${error.message}`);
    process.exit(1);
    return;
  }

  // Project validation & script sequence calculation step
  const validationSpinner = spinner();
  validationSpinner.start('Analyzing project structure...');
  const validationResult = await validateProject(
    process.cwd(),
    preflight.hasAgy
  );

  if (!validationResult.isValid) {
    validationSpinner.stop(pc.red('Failed to analyze project.'));
    const home = os.homedir();
    const formattedError = (validationResult.error || '').replace(home, '~');
    log.error(pc.red(`Error: ${formattedError}`));
    process.exit(1);
    return;
  }

  validationSpinner.stop(pc.green('Project analyzed successfully!'));

  // Log warnings
  if (validationResult.warnings.length > 0) {
    for (const warning of validationResult.warnings) {
      log.warn(pc.yellow(`⚠️  ${warning}`));
    }
  }

  // Display computed script sequence
  log.message(
    pc.cyan(
      `Recommended commands for this project (${pc.bold(
        validationResult.projectType
      )}):`
    )
  );
  validationResult.scriptSequence.forEach((step, idx) => {
    console.log(
      `  ${pc.bold(pc.magenta(`${idx + 1}. ${step.command}`))} \n  ${pc.dim(step.description)}\n`
    );
  });

  if (validationResult.scriptSequence.length > 0) {
    const shouldExecute = await confirm({
      message:
        'Do you want to run the recommended command sequence in the target project?',
      initialValue: true,
    });

    /* v8 ignore start */
    if (typeof shouldExecute === 'symbol') {
      log.error('Operation cancelled.');
      process.exit(1);
      return;
    }

    if (shouldExecute) {
      log.info('Running recommended command sequence...');
      for (const step of validationResult.scriptSequence) {
        log.step(`Running: ${step.command} (${step.description})`);
        try {
          await execa(step.command, {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: true,
          });
        } catch (err: any) {
          log.error(`Failed to run command "${step.command}": ${err.message}`);
          const shouldContinue = await confirm({
            message:
              'Do you want to continue with the remaining commands in the sequence?',
            initialValue: false,
          });
          if (typeof shouldContinue === 'symbol' || !shouldContinue) {
            log.error('Operation cancelled.');
            process.exit(1);
            return;
          }
        }
      }
      log.success('Recommended command sequence executed successfully.');
    }
    /* v8 ignore stop */
  }

  // 1. Load Configurations
  let globalConfig = await configManager.loadGlobal();
  /* v8 ignore start */
  if (globalConfig.containers.length === 0) {
    log.warn('No global search directories configured.');
    const shouldConfigure = await confirm({
      message: 'Do you want to configure your global project directories now?',
      initialValue: true,
    });

    if (typeof shouldConfigure === 'symbol' || !shouldConfigure) {
      log.error(
        'Operation cancelled. A global search directory is required to continue.'
      );
      process.exit(1);
      return;
    }

    const pathsInput = await text({
      message: 'Enter search paths for your projects (comma-separated):',
      placeholder: '~/projects, /var/www',
      validate: value => {
        if (!value.trim()) return 'Path cannot be empty.';
        return;
      },
    });

    if (typeof pathsInput === 'symbol') {
      log.error('Operation cancelled.');
      process.exit(1);
      return;
    }

    const containers = pathsInput
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    // Validate that at least one directory exists
    const validContainers: string[] = [];
    for (const rawDir of containers) {
      let resolvedDir: string;
      if (rawDir.startsWith('~/') || rawDir === '~') {
        resolvedDir = path.join(os.homedir(), rawDir.slice(1));
      } else {
        resolvedDir = path.resolve(rawDir);
      }

      try {
        const stat = await fs.stat(resolvedDir);
        if (stat.isDirectory()) {
          validContainers.push(rawDir);
        } else {
          log.error(`Path '${rawDir}' is not a valid directory.`);
        }
      } catch {
        log.error(`Path '${rawDir}' does not exist or is not accessible.`);
      }
    }

    if (validContainers.length === 0) {
      log.error('No valid search directories entered. Aborting.');
      process.exit(1);
      return;
    }

    globalConfig = { containers: validContainers };
    await configManager.saveGlobal(globalConfig);
    log.success(
      `Global configuration successfully saved in ~/.nodepirc.json with: ${validContainers.join(', ')}`
    );
  }
  /* v8 ignore stop */

  // 2. Scan Local Containers and Target Dependency Tree
  const s = spinner();
  s.start('Scanning local directories and project dependencies...');

  const localPackages = await scanContainers(globalConfig.containers);
  const graph = await buildDependencyGraph(process.cwd());

  s.stop('Scan completed.');

  const targetDeps = graph.get('target') || [];
  const linkableDeps = targetDeps.filter(dep => localPackages.has(dep));

  if (linkableDeps.length === 0) {
    log.warn(
      'No dependencies found in node_modules that match your local packages.'
    );
    process.exit(0);
    return;
  }

  // 3. User selects packages to inject or sync
  const localConfig = await configManager.load();
  const initialSelections = localConfig.dependencies
    .map(d => d.name)
    .filter(name => linkableDeps.includes(name));

  const selectedDeps = await multiselect({
    message: 'Select local dependencies you want to inject or synchronize:',
    options: linkableDeps.map(dep => ({
      value: dep,
      label: dep,
      hint: localPackages.get(dep),
    })),
    required: true,
    initialValues: initialSelections,
  });

  /* v8 ignore start */
  if (typeof selectedDeps === 'symbol') {
    log.error('Operation cancelled.');
    process.exit(1);
    return;
  }
  /* v8 ignore stop */

  // 4. Git Guard & Version Guard checks
  for (const dep of selectedDeps) {
    const localPath = localPackages.get(dep)!;
    const targetDepPath = resolveDependencyPath(process.cwd(), dep);

    // Git Guard
    let gitStatus = await getGitStatus(localPath);
    if (gitStatus.isGit) {
      if (gitStatus.hasUpstream && gitStatus.isBehind) {
        log.warn(
          `Local dependency ${dep} is behind its upstream by ${gitStatus.behindCount} commits.`
        );
        /* v8 ignore start */
        const shouldPull = await confirm({
          message: `Do you want NodePi to run 'git pull' automatically in ${dep}?`,
          initialValue: true,
        });

        if (typeof shouldPull === 'symbol') {
          log.error('Operation cancelled.');
          process.exit(1);
          return;
        }

        if (shouldPull) {
          const sPull = spinner();
          sPull.start(`Running 'git pull' in ${dep}...`);
          try {
            await execa('git', ['pull'], { cwd: localPath });
            sPull.stop(pc.green(`'git pull' executed successfully in ${dep}.`));

            // Re-evaluate git status
            gitStatus = await getGitStatus(localPath);
            if (gitStatus.hasUpstream && gitStatus.isBehind) {
              log.error(
                `Local dependency ${dep} is still out of date after pulling. Aborting.`
              );
              process.exit(1);
              return;
            }
          } catch (err: any) {
            sPull.stop(pc.red(`Error executing 'git pull': ${err.message}`));
            process.exit(1);
            return;
          }
        } else {
          log.error(
            `Operation cancelled. Please update ${dep} before continuing.`
          );
          process.exit(1);
          return;
        }
        /* v8 ignore stop */
      }
      log.info(
        `[Git] ${dep}: Branch '${gitStatus.branch}' verified and up-to-date.`
      );
    } else {
      log.warn(`[Git] ${dep}: Not inside a Git repository. Skipping checks.`);
    }

    // Version Guard
    const versionMismatch = await getVersionMismatch(localPath, targetDepPath);
    if (versionMismatch.hasMismatch) {
      log.warn(
        `[Version] ${dep}: Mismatch detected. Local ${versionMismatch.localVersion} vs Target ${versionMismatch.targetVersion} (${versionMismatch.type})`
      );
    }
  }

  // 5. Autodiscover transitive chains
  const allDepsToProcess = [...selectedDeps];
  for (const dep of selectedDeps) {
    const intermediates = findIntermediateDependencies(
      'target',
      dep,
      graph,
      localPackages
    );
    for (const inter of intermediates) {
      if (!allDepsToProcess.includes(inter)) {
        log.info(
          `Autodetected local intermediate link: ${inter} (will be included in the process)`
        );
        allDepsToProcess.push(inter);
      }
    }
  }

  // 6. Select execution mode
  const mode = await select({
    message: 'Select execution mode for the dependencies:',
    options: [
      { value: 'inject', label: 'Injection Mode (One-time static copy)' },
      {
        value: 'sync',
        label: 'Synchronization Mode (Live watching + HMR)',
      },
    ],
    initialValue: localConfig.mode || 'inject',
  });

  /* v8 ignore start */
  if (typeof mode === 'symbol') {
    log.error('Operation cancelled.');
    process.exit(1);
    return;
  }
  /* v8 ignore stop */

  // 7. Resolve compilation scripts and out directories
  const resolvedScripts = new Map<
    string,
    { buildScript: string | null; watchScript: string | null; outDir: string }
  >();
  for (const dep of allDepsToProcess) {
    const localPath = localPackages.get(dep)!;
    const pkgJson = JSON.parse(
      await fs.readFile(path.join(localPath, 'package.json'), 'utf-8')
    );

    /* v8 ignore start */
    const promptFallback = async (): Promise<ScriptAnalysisResult> => {
      log.warn(`Could not resolve build process for ${dep} using AI.`);
      const buildScr = await select({
        message: `Select build script for ${dep}:`,
        options: [
          { value: 'null', label: 'None (Pure JavaScript)' },
          ...Object.keys(pkgJson.scripts || {}).map(s => ({
            value: s,
            label: s,
          })),
        ],
      });

      if (typeof buildScr === 'symbol') {
        log.error('Operation cancelled.');
        process.exit(1);
        return { buildScript: null, watchScript: null, outDir: '.' };
      }

      let watchScr: string | symbol | null = null;
      if (buildScr !== 'null') {
        watchScr = await select({
          message: `Select watch script for ${dep}:`,
          options: [
            { value: 'null', label: 'None' },
            ...Object.keys(pkgJson.scripts || {}).map(s => ({
              value: s,
              label: s,
            })),
          ],
        });
        if (typeof watchScr === 'symbol') {
          log.error('Operation cancelled.');
          process.exit(1);
          return { buildScript: null, watchScript: null, outDir: '.' };
        }
      }

      const outDirInput = await text({
        message: `Specify output directory (outDir) for ${dep}:`,
        placeholder: 'dist',
        initialValue: 'dist',
      });

      if (typeof outDirInput === 'symbol') {
        log.error('Operation cancelled.');
        process.exit(1);
        return { buildScript: null, watchScript: null, outDir: '.' };
      }

      return {
        buildScript: buildScr === 'null' ? null : buildScr,
        watchScript:
          watchScr === 'null' || !watchScr ? null : (watchScr as string),
        outDir: outDirInput || 'dist',
      };
    };
    /* v8 ignore stop */

    const resolution = await resolveBuildAndWatch(
      localPath,
      pkgJson,
      preflight.hasAgy,
      promptFallback as any
    );
    resolvedScripts.set(dep, resolution);
  }

  // 8. Perform backup
  s.start('Creating dependency backups...');
  backupRestoreManager.backup(allDepsToProcess, preflight.viteConfigPath);
  s.stop('Backups created.');

  // 9. Setup Exit Handlers if running in live watch sync mode
  if (mode === 'sync') {
    setupExitHandlers();
  }

  // 10. Generate Vite HMR wrapper if target project uses Vite
  if (preflight.isViteProject && preflight.viteConfigPath) {
    await writeViteWrapper(
      process.cwd(),
      preflight.viteConfigPath,
      allDepsToProcess
    );
  }

  // 11. Initial Compile and Overwrite
  for (const dep of allDepsToProcess) {
    const localPath = localPackages.get(dep)!;
    const targetDepPath = resolveDependencyPath(process.cwd(), dep);
    const res = resolvedScripts.get(dep)!;

    // Run build script if present
    if (res.buildScript) {
      s.start(`Compiling dependency ${dep} (npm run ${res.buildScript})...`);
      const cmdParts = res.buildScript.split(' ');
      if (
        cmdParts[0] === 'npm' ||
        cmdParts[0] === 'yarn' ||
        cmdParts[0] === 'pnpm'
      ) {
        await execa(cmdParts[0], cmdParts.slice(1), { cwd: localPath });
      } else {
        await execa('npm', ['run', res.buildScript], { cwd: localPath });
      }
      s.stop(`Compilation of ${dep} finished.`);
    }

    // Sync compiled folder to node_modules via rsync
    const destRelativePath = path.relative(process.cwd(), targetDepPath);
    s.start(`Injecting local files into ${destRelativePath}...`);
    const sourceSyncPath = path.join(localPath, res.outDir);
    await runRsync(sourceSyncPath, targetDepPath);
    await patchEntrypoint(targetDepPath, res.outDir);
    s.stop(`Injection of ${dep} completed.`);

    // Start watching if sync mode is enabled
    if (mode === 'sync') {
      if (res.watchScript) {
        let watchCmd = res.watchScript;
        if (!watchCmd.includes(' ')) {
          watchCmd = `npm run ${watchCmd}`;
        }
        await dependencyOrchestrator.spawnCompiler(dep, localPath, watchCmd);
      }
      await dependencyOrchestrator.startWatching(
        dep,
        sourceSyncPath,
        targetDepPath
      );
    }
  }

  // 12. Save local configuration file
  const savedDeps = allDepsToProcess.map(dep => ({
    name: dep,
    sourcePath: localPackages.get(dep)!,
  }));
  await configManager.save({
    mode: mode as 'sync' | 'inject',
    dependencies: savedDeps,
  });

  if (mode === 'inject') {
    logger.info('Wizard', 'NodePi injection completed successfully.');
    outro('NodePi injection completed successfully.');
  } else {
    logger.info('Wizard', 'Live synchronization active.');
    outro(
      `Live synchronization active. Press Ctrl+C to terminate and restore the target project.\nBackground logs are written to: ${logger.getLogFilePath()}`
    );
    // Hang process indefinitely to keep chokidar watching alive
    /* v8 ignore start */
    if (process.env.NODE_ENV !== 'test') {
      await new Promise(() => {});
    }
    /* v8 ignore stop */
  }
}
