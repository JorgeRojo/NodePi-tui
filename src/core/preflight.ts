import { confirm, log, spinner } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

import { backupRestoreManager } from './backup-restore.js';

export interface PreflightResult {
  isViteProject: boolean;
  viteConfigPath: string | null;
  hasAgy: boolean;
}

/**
 * Checks if a CLI command is available in the user's system PATH.
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execa('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs all system preflight checks and returns project characteristics.
 */
export async function runPreflight(): Promise<PreflightResult> {
  // 1. Post-Crash Recovery Check
  if (backupRestoreManager.hasBackup()) {
    log.warn(
      pc.yellow(
        '⚠️  NodePi ha detectado un cierre inesperado en una ejecución anterior.'
      )
    );

    const shouldRestore = await confirm({
      message:
        '¿Deseas restaurar los archivos del proyecto destino a su estado original?',
      initialValue: true,
    });

    if (typeof shouldRestore === 'symbol') {
      log.error('Operación cancelada.');
      process.exit(1);
      return undefined as any;
    }

    if (shouldRestore) {
      const s = spinner();
      s.start('Restaurando copias de seguridad...');
      try {
        backupRestoreManager.restore();
        s.stop(pc.green('¡Entorno restaurado con éxito a su estado original!'));
      } catch (err: any) {
        s.stop(pc.red(`Error al restaurar: ${err.message}`));
        process.exit(1);
        return undefined as any;
      }
    } else {
      log.warn(
        pc.yellow(
          'Restauración omitida. El proyecto podría estar en un estado inconsistente.'
        )
      );
    }
  }

  // 2. System Tools Validation
  const targetDir = process.cwd();
  const s = spinner();
  s.start('Validando requisitos del sistema...');

  const hasRsync = await commandExists('rsync');
  const hasGit = await commandExists('git');
  const hasAgy = await commandExists('agy');

  if (!hasRsync || !hasGit) {
    s.stop(pc.red('Fallo en la validación de requisitos del sistema.'));

    const missing = [];
    if (!hasRsync) missing.push('rsync');
    if (!hasGit) missing.push('git');

    log.error(
      pc.red(
        `Error: Faltan las siguientes herramientas requeridas: ${missing.join(', ')}`
      )
    );
    log.message(
      pc.dim(
        'Por favor, instala estas herramientas en tu sistema antes de continuar.'
      )
    );
    process.exit(1);
    return undefined as any;
  }

  // 3. Vite Detection
  const viteFiles = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
    'vite.config.mts',
  ];

  let viteConfigPath: string | null = null;
  let isViteProject = false;

  for (const file of viteFiles) {
    const filePath = path.join(targetDir, file);
    if (fs.existsSync(filePath)) {
      viteConfigPath = filePath;
      isViteProject = true;
      break;
    }
  }

  // Create summary log strings
  const rsyncStatus = pc.green('[✓] rsync detectado');
  const gitStatus = pc.green('[✓] git detectado');
  const agyStatus = hasAgy
    ? pc.green('[✓] agy detectado (inferencia IA activada)')
    : pc.yellow('[!] agy NO detectado (se usará fallback interactivo manual)');
  const viteStatus = isViteProject
    ? pc.green(
        '[✓] Configuración de Vite detectada (integraciones Vite HMR activadas)'
      )
    : pc.yellow(
        '[!] Configuración de Vite no detectada (se omitirán wrappers de Vite)'
      );

  s.stop(pc.green('¡Requisitos del sistema validados!'));

  // Show detailed checklist
  console.log(
    pc.dim(
      `  ${rsyncStatus}\n  ${gitStatus}\n  ${agyStatus}\n  ${viteStatus}\n`
    )
  );

  return {
    isViteProject,
    viteConfigPath,
    hasAgy,
  };
}
