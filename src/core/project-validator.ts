import { log } from '@clack/prompts';
import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

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
    if (scriptName === 'start' || scriptName === 'test') {
      return `npm ${scriptName}`;
    }
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
        error: `No se encontró package.json en el directorio: ${targetDir}`,
      };
    }
  } catch {
    return {
      isValid: false,
      packageManager: 'npm',
      projectType: 'other',
      scriptSequence: [],
      warnings: [],
      error: `No se encontró package.json en el directorio: ${targetDir}`,
    };
  }

  // 1. Read files in target directory and load package.json
  let files: string[] = [];
  try {
    files = await fs.readdir(targetDir);
  } catch {
    // Ignore and proceed with empty list
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
      error: `Error al leer o parsear package.json: ${errMsg}`,
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
      'Este proyecto utiliza Yarn (yarn.lock). NodePi funciona de manera agnóstica sincronizando archivos en node_modules, pero asegúrate de realizar la instalación inicial con Yarn para evitar conflictos.'
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
      'Se han detectado dependencias de RedPoints. Asegúrate de tener configurado tu acceso al registry privado (Nexus) antes de instalar dependencias.'
    );
  }

  const scripts = (packageJson.scripts || {}) as Record<string, string>;

  // 3. AI-driven sequence resolution if hasAgy is true
  if (hasAgy) {
    try {
      const simplifiedPackageJson = {
        name: packageJson.name,
        scripts: packageJson.scripts || {},
        dependencies: packageJson.dependencies ? Object.keys(packageJson.dependencies) : [],
        devDependencies: packageJson.devDependencies ? Object.keys(packageJson.devDependencies) : [],
      };

      const prompt = `Eres un asistente de desarrollo experto y especialista en flujos de inyección y sincronización de dependencias locales (usando NodePi).
Tu objetivo es deducir los comandos exactos de terminal (scripts) y el tipo de proyecto destino para preparar/instalar el entorno local antes de continuar con la inyección.

Sigue estrictamente estas directrices para la secuencia de comandos:
1. Recomienda únicamente los comandos iniciales necesarios para instalar dependencias y realizar la configuración preliminar del entorno.
2. Los comandos recomendados en la secuencia deben ser exactamente los definidos en el package.json, sin añadir prefijos de variables de entorno ni modificar su sintaxis.
3. Excluye por completo comandos destinados a compilar el proyecto o a arrancar servidores de desarrollo.
4. Identifica y agrega en "warnings" advertencias clave sobre variables de entorno requeridas, red/VPN, hosts locales, certificados o cualquier pre-requisito crítico para configurar el entorno.

---
DATOS DEL PROYECTO DESTINO:
Nombre: ${packageJson.name || 'proyecto'}
Archivos en la raíz: ${files.join(', ')}

<package_json>
${JSON.stringify(simplifiedPackageJson, null, 2)}
</package_json>
---

Responde ÚNICAMENTE con un bloque de código JSON encerrado en triples comillas invertidas (\`\`\`json ... \`\`\`) con la siguiente estructura:

\`\`\`json
{
  "projectType": "standard-vite" | "bundle-interface-module" | "other",
  "sequence": [
    {
      "command": "comando_de_consola",
      "description": "explicación de qué hace este comando en 1 línea"
    }
  ],
  "warnings": [
    "advertencia_relevante_1"
  ]
}
\`\`\`

No agregues texto explicativo ni antes ni después del bloque de código JSON.`;

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
        { timeout: 45000 }
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

        let sequence = parsed.sequence;
        if (scripts['setup']) {
          sequence = [
            {
              command: getRunCommand(packageManager, 'setup'),
              description: 'Inicializa y configura el proyecto para el desarrollo (incluye toda la lógica de preparación e instalación necesaria).',
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
      log.error(`[NodePi] Fallo en la llamada a agy al analizar la estructura del proyecto destino: ${err.message}`);
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
          'Instala dependencias locales e inicializa el entorno aislado con install-devApp.',
      },
    ];

    if (scripts['conf']) {
      sequence.push({
        command: getRunCommand(packageManager, 'conf'),
        description:
          'Descarga las configuraciones del entorno de pruebas (APIs de Portal).',
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
        description: 'Inicializa y configura el proyecto para el desarrollo.',
      });
    } else {
      const installCmd = scripts['install:dependencies']
        ? getRunCommand(packageManager, 'install:dependencies')
        : `${packageManager} install`;
      sequence.push({
        command: installCmd,
        description: 'Instala las dependencias del proyecto.',
      });

      if (scripts['conf']) {
        sequence.push({
          command: getRunCommand(packageManager, 'conf'),
          description: 'Descarga las configuraciones de APIs de desarrollo.',
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
      description: 'Inicializa y configura el proyecto.',
    });
  } else {
    const installCmd = scripts['install:dependencies']
      ? getRunCommand(packageManager, 'install:dependencies')
      : `${packageManager} install`;
    fallbackSequence.push({
      command: installCmd,
      description: 'Instala las dependencias del proyecto.',
    });

    if (scripts['conf']) {
      fallbackSequence.push({
        command: getRunCommand(packageManager, 'conf'),
        description: 'Descarga las configuraciones de APIs de desarrollo.',
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
