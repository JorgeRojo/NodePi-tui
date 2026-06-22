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
import { dependencyOrchestrator } from './core/orchestrator.js';
import { runPreflight } from './core/preflight.js';
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

const banner = `
░█▀█░█▀█░█▀▄░█▀▀░█▀█░▀█▀
░█░█░█░█░█░█░█▀▀░█▀▀░░█░
░▀░▀░▀▀▀░▀▀░░▀▀▀░▀░░░▀▀▀
`;

function colorizeBanner(str: string): string {
  const solidColors = [63, 105, 141]; // Vertical gradient: Slate Blue/Bluish Lilac (63) -> Light Bluish Lilac (105) -> Bright Lilac (141)
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

  let preflight;
  try {
    preflight = await runPreflight();
  } catch (error: any) {
    log.error(`Error fatal en Preflight: ${error.message}`);
    process.exit(1);
    return;
  }

  // 1. Load Configurations
  let globalConfig = await configManager.loadGlobal();
  if (globalConfig.containers.length === 0) {
    log.warn('No se han configurado directorios de búsqueda globales.');
    const shouldConfigure = await confirm({
      message:
        '¿Deseas configurar tus directorios globales de proyectos ahora?',
      initialValue: true,
    });

    if (typeof shouldConfigure === 'symbol' || !shouldConfigure) {
      log.error(
        'Operación cancelada. Se requiere un directorio de búsqueda global para continuar.'
      );
      process.exit(1);
      return;
    }

    const pathsInput = await text({
      message:
        'Ingresa las rutas de búsqueda de tus proyectos (separadas por comas):',
      placeholder: '~/projects, /var/www',
      validate: value => {
        if (!value.trim()) return 'La ruta no puede estar vacía.';
        return;
      },
    });

    if (typeof pathsInput === 'symbol') {
      log.error('Operación cancelada.');
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
          log.error(`La ruta '${rawDir}' no es un directorio válido.`);
        }
      } catch {
        log.error(`La ruta '${rawDir}' no existe o no es accesible.`);
      }
    }

    if (validContainers.length === 0) {
      log.error('No se ingresaron directorios de búsqueda válidos. Abortando.');
      process.exit(1);
      return;
    }

    globalConfig = { containers: validContainers };
    await configManager.saveGlobal(globalConfig);
    log.success(
      `Configuración global guardada con éxito en ~/.nodepirc.json con: ${validContainers.join(', ')}`
    );
  }

  const localConfig = await configManager.load();

  // 2. Scan Local Containers and Target Dependency Tree
  const s = spinner();
  s.start('Escaneando directorios locales y dependencias del proyecto...');

  const localPackages = await scanContainers(globalConfig.containers);
  const graph = await buildDependencyGraph(process.cwd());

  s.stop('Escaneo completado.');

  const targetDeps = graph.get('target') || [];
  const linkableDeps = targetDeps.filter(dep => localPackages.has(dep));

  if (linkableDeps.length === 0) {
    log.warn(
      'No se encontraron dependencias en node_modules que coincidan con tus paquetes locales.'
    );
    process.exit(0);
    return;
  }

  // 3. User selects packages to inject or sync
  const initialSelections = localConfig.dependencies
    .map(d => d.name)
    .filter(name => linkableDeps.includes(name));

  const selectedDeps = await multiselect({
    message:
      'Selecciona las dependencias locales que deseas inyectar o sincronizar:',
    options: linkableDeps.map(dep => ({
      value: dep,
      label: dep,
      hint: localPackages.get(dep),
    })),
    required: true,
    initialValues: initialSelections,
  });

  if (typeof selectedDeps === 'symbol') {
    log.error('Operación cancelada.');
    process.exit(1);
    return;
  }

  // 4. Git Guard & Version Guard checks
  for (const dep of selectedDeps) {
    const localPath = localPackages.get(dep)!;
    const targetDepPath = resolveDependencyPath(process.cwd(), dep);

    // Git Guard
    let gitStatus = await getGitStatus(localPath);
    if (gitStatus.isGit) {
      if (gitStatus.hasUpstream && gitStatus.isBehind) {
        log.warn(
          `La dependencia local ${dep} está por detrás de su upstream por ${gitStatus.behindCount} commits.`
        );
        const shouldPull = await confirm({
          message: `¿Deseas que NodePi ejecute 'git pull' automáticamente en ${dep}?`,
          initialValue: true,
        });

        if (typeof shouldPull === 'symbol') {
          log.error('Operación cancelada.');
          process.exit(1);
          return;
        }

        if (shouldPull) {
          const sPull = spinner();
          sPull.start(`Ejecutando 'git pull' en ${dep}...`);
          try {
            await execa('git', ['pull'], { cwd: localPath });
            sPull.stop(pc.green(`'git pull' ejecutado con éxito en ${dep}.`));

            // Re-evaluate git status
            gitStatus = await getGitStatus(localPath);
            if (gitStatus.hasUpstream && gitStatus.isBehind) {
              log.error(
                `La dependencia local ${dep} sigue desactualizada después del pull. Abortando.`
              );
              process.exit(1);
              return;
            }
          } catch (err: any) {
            sPull.stop(pc.red(`Error al ejecutar 'git pull': ${err.message}`));
            process.exit(1);
            return;
          }
        } else {
          log.error(
            `Operación cancelada. Por favor, actualiza ${dep} antes de continuar.`
          );
          process.exit(1);
          return;
        }
      }
      log.info(`[Git] ${dep}: Rama '${gitStatus.branch}' confirmada y al día.`);
    } else {
      log.warn(
        `[Git] ${dep}: No se encuentra en un repositorio Git. Omitiendo comprobaciones.`
      );
    }

    // Version Guard
    const versionMismatch = await getVersionMismatch(localPath, targetDepPath);
    if (versionMismatch.hasMismatch) {
      log.warn(
        `[Versión] ${dep}: Desajuste detectado. Local ${versionMismatch.localVersion} vs Target ${versionMismatch.targetVersion} (${versionMismatch.type})`
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
          `Autodetectado eslabón intermedio local: ${inter} (se incluirá en el proceso)`
        );
        allDepsToProcess.push(inter);
      }
    }
  }

  // 6. Select execution mode
  const mode = await select({
    message: 'Selecciona el modo de operación para las dependencias:',
    options: [
      { value: 'inject', label: 'Injection Mode (Copia estática única)' },
      {
        value: 'sync',
        label: 'Synchronization Mode (Observación en vivo + HMR)',
      },
    ],
    initialValue: localConfig.mode || 'inject',
  });

  if (typeof mode === 'symbol') {
    log.error('Operación cancelada.');
    process.exit(1);
    return;
  }

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

    const promptFallback = async (): Promise<ScriptAnalysisResult> => {
      log.warn(`No se pudo resolver la compilación de ${dep} mediante IA.`);
      const buildScr = await select({
        message: `Selecciona el script de compilación para ${dep}:`,
        options: [
          { value: 'null', label: 'Ninguno (JavaScript Puro)' },
          ...Object.keys(pkgJson.scripts || {}).map(s => ({
            value: s,
            label: s,
          })),
        ],
      });

      if (typeof buildScr === 'symbol') {
        log.error('Operación cancelada.');
        process.exit(1);
        return { buildScript: null, watchScript: null, outDir: '.' };
      }

      let watchScr: string | symbol | null = null;
      if (buildScr !== 'null') {
        watchScr = await select({
          message: `Selecciona el script de observación (watch) para ${dep}:`,
          options: [
            { value: 'null', label: 'Ninguno' },
            ...Object.keys(pkgJson.scripts || {}).map(s => ({
              value: s,
              label: s,
            })),
          ],
        });
        if (typeof watchScr === 'symbol') {
          log.error('Operación cancelada.');
          process.exit(1);
          return { buildScript: null, watchScript: null, outDir: '.' };
        }
      }

      const outDirInput = await text({
        message: `Especifica el directorio de salida (outDir) para ${dep}:`,
        placeholder: 'dist',
        initialValue: 'dist',
      });

      if (typeof outDirInput === 'symbol') {
        log.error('Operación cancelada.');
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

    const resolution = await resolveBuildAndWatch(
      localPath,
      pkgJson,
      promptFallback as any
    );
    resolvedScripts.set(dep, resolution);
  }

  // 8. Perform backup
  s.start('Creando copias de seguridad de las dependencias...');
  backupRestoreManager.backup(allDepsToProcess, preflight.viteConfigPath);
  s.stop('Copias de seguridad creadas.');

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
      s.start(`Compilando dependencia ${dep} (npm run ${res.buildScript})...`);
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
      s.stop(`Compilación de ${dep} finalizada.`);
    }

    // Sync compiled folder to node_modules via rsync
    const destRelativePath = path.relative(process.cwd(), targetDepPath);
    s.start(`Inyectando archivos locales en ${destRelativePath}...`);
    const sourceSyncPath = path.join(localPath, res.outDir);
    await runRsync(sourceSyncPath, targetDepPath);
    await patchEntrypoint(targetDepPath, res.outDir);
    s.stop(`Inyección de ${dep} completada.`);

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
    outro('NodePi finalizó la inyección de forma exitosa.');
  } else {
    outro(
      'Sincronización en vivo activa. Presiona Ctrl+C para finalizar y restaurar el proyecto destino.'
    );
    // Hang process indefinitely to keep chokidar watching alive
    if (process.env.NODE_ENV !== 'test') {
      await new Promise(() => {});
    }
  }
}
