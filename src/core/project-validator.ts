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

  // 3. Try deterministic detection
  // Type A: bundle-interface-module
  const isBundleInterfaceModule =
    Boolean(devDependencies['redpoints-front-bundle-interface-rp10']) ||
    Boolean(dependencies['redpoints-front-bundle-interface-rp10']) ||
    Boolean(scripts['install-devApp']);

  if (isBundleInterfaceModule) {
    const installCmd = scripts['install:dependencies']
      ? `${packageManager} install:dependencies`
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
        command: `${packageManager} conf`,
        description:
          'Descarga las configuraciones del entorno de pruebas (APIs de Portal).',
      });
    }

    if (scripts['start']) {
      sequence.push({
        command: `${packageManager} start`,
        description: 'Inicia el servidor local de desarrollo de Vite.',
      });
    }

    if (scripts['dist']) {
      sequence.push({
        command: `${packageManager} dist`,
        description: 'Compila y empaqueta el bundle final para producción.',
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
    const sequence: ScriptStep[] = [
      {
        command: `${packageManager} install`,
        description: 'Instala las dependencias del proyecto.',
      },
    ];

    if (scripts['conf']) {
      sequence.push({
        command: `${packageManager} conf`,
        description: 'Descarga las configuraciones de APIs de desarrollo.',
      });
    }

    // Find the dev/start script
    let runDevCmd = `${packageManager} run dev`;
    if (scripts['dev']) {
      runDevCmd = `${packageManager} dev`;
    } else if (scripts['start']) {
      runDevCmd = `${packageManager} start`;
    }

    sequence.push({
      command: runDevCmd,
      description: 'Inicia el servidor de desarrollo de Vite.',
    });

    if (scripts['build']) {
      sequence.push({
        command: `${packageManager} build`,
        description: 'Compila el proyecto para producción.',
      });
    }

    return {
      isValid: true,
      packageManager,
      projectType: 'standard-vite',
      scriptSequence: sequence,
      warnings,
    };
  }

  // 4. If not deterministic, fall back to agy (if available) or programmatic default
  if (hasAgy) {
    try {
      const prompt = `Eres un asistente de desarrollo experto. Tu objetivo es deducir la secuencia exacta de comandos de terminal (scripts) que un desarrollador debe ejecutar para levantar el entorno de desarrollo y compilar el proyecto basándote en la estructura de su package.json y los archivos en la raíz.

---
DATOS DEL PROYECTO:
Nombre: ${packageJson.name || 'proyecto'}
Archivos en la raíz: ${files.join(', ')}

<package_json>
${JSON.stringify(packageJson, null, 2)}
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
          '--print',
          prompt,
          '--print-timeout',
          '5s',
          '--dangerously-skip-permissions',
        ],
        { timeout: 5000 }
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
        return {
          isValid: true,
          packageManager,
          projectType: parsed.projectType || 'other',
          scriptSequence: parsed.sequence,
          warnings,
        };
      }
    } catch {
      // Ignore agy errors and fall back to programmatic default
    }
  }

  // Programmatic fallback for 'other'
  const fallbackSequence: ScriptStep[] = [
    {
      command: `${packageManager} install`,
      description: 'Instala las dependencias del proyecto.',
    },
  ];

  if (scripts['dev']) {
    fallbackSequence.push({
      command: `${packageManager} dev`,
      description: 'Inicia el servidor de desarrollo.',
    });
  } else if (scripts['start']) {
    fallbackSequence.push({
      command: `${packageManager} start`,
      description: 'Inicia el servidor de desarrollo.',
    });
  }

  if (scripts['build']) {
    fallbackSequence.push({
      command: `${packageManager} build`,
      description: 'Compila el proyecto.',
    });
  }

  return {
    isValid: true,
    packageManager,
    projectType: 'other',
    scriptSequence: fallbackSequence,
    warnings,
  };
}
