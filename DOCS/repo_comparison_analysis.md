# Análisis Comparativo: Repositorios Reales vs. Plan NodePi

He realizado un análisis profundo y exhaustivo de los **69 directorios** del workspace `/Users/jorge/projects/frontend-repos`. Este informe compara las características físicas reales de la base de código con el plan actual de NodePi, identificando discrepancias de diseño críticas que debemos solucionar para evitar fallos catastróficos al usar la herramienta.

---

## 📊 Estadísticas Reales del Workspace

De las 69 carpetas escaneadas, **65 son proyectos de Node válidos** (tienen un `package.json` legible). Los resultados agregados son los siguientes:

### 1. Control de Versiones y Git

- **Proyectos Git**: 65 de 65 (100%).
- **Upstream/Remote configurado**: 65 de 65 (100%).
- **Conclusión**: El _Git Guard_ propuesto es totalmente compatible con el entorno, pero debemos mantener los resguardos para proyectos locales nuevos.

### 2. Gestor de Paquetes

- **Yarn (`yarn.lock`)**: 65 de 65 (100%).
- **pnpm / npm**: 0 de 65 (0%).
- **Conclusión**: **Advertencia Crítica**. Todos los proyectos usan Yarn. La inyección de NodePi forzará la creación de `pnpm-lock.yaml` en el proyecto destino para poder resolver las inyecciones físicas. El warning de colisión en el Preflight es indispensable y siempre se disparará.

### 3. TypeScript y Configuraciones

- **Proyectos con `tsconfig.json`**: 32 (Aprox 50%).
- **Archivos TSConfig alternativos**:
  - La gran mayoría de los conectores y librerías TS tienen **múltiples archivos tsconfig** (ej. `tsconfig.json` y `tsconfig.build.json` o `tsconfig.base.json`).
  - Ejemplo: `actor-networks-restapi-connector` tiene `tsconfig.json` (desarrollo/tests) y `tsconfig.build.json` (para empaquetado de producción).

### 4. Bundlers

- **Vite**: 7 proyectos (Backoffice, Dashboards, Front-common-rp10, Front-components-rp10, Front-rp10, Frontoffice, Myaccount).
- **Webpack**: 4 proyectos.
- **Rollup**: 2 proyectos.
- **Babel**: 5 proyectos.
- **Sin Bundler Explícito (tsc puro / JS vanilla)**: 51 proyectos (78% de la base).

### 5. Scripts de Compilación

- **Tienen script de watch**: 56 proyectos (86%).
- **Tienen script de build**: 40 proyectos (61%).
- **Sin script de watch ni build**: 7 proyectos (conectores/librerías que usan scripts customizados como `dist`).

---

## 🔍 Discrepancias Críticas Detectadas (Realidad vs. Plan)

Comparando el estado real del código contra el plan de NodePi, han surgido **3 nuevos vacíos arquitectónicos** que la aplicación debe resolver:

### Discrepancia 1: El Hash de la Caché ignora TSConfigs Auxiliares

> [!NOTE] **El problema**: El plan original de caching escaneaba solo `tsconfig.json`. Sin embargo, casi todos los conectores de RedPoints compilan usando `tsconfig.build.json` (ej: `tsc -p ./tsconfig.build.json`).
>
> **✅ RESUELTO**: Se actualizó `script-cache.ts` para buscar cualquier archivo que coincida con `tsconfig*.json` (`f.startsWith('tsconfig') && f.endsWith('.json')`).

### Discrepancia 2: Proyectos de TypeScript sin Script de Watch

> [!IMPORTANT] **El problema**: Siete librerías críticas (como `redpoints-front-testing`, `redpoints-front-translate`, `redpoints-front-qdeveloper-rules`) carecen por completo de un script `"watch"` en su `package.json`. No obstante, sí son TypeScript y compilan mediante un script de build llamado `"dist"` que corre `tsc -p ./tsconfig.build.json`.
>
> **La Solución**: Si un paquete es TypeScript (tiene archivos `tsconfig*.json`) y el plan de NodePi requiere Sync pero no tiene script `watch`, el motor de fallback debe saltarse la IA y ejecutar automáticamente el compilador nativo en modo watch:
>
> ```bash
> tsc -w -p ./tsconfig.build.json # (o tsconfig.json si es el único disponible)
> ```

### Discrepancia 3: Estructura de Publicación Desacoplada (La gran discrepancia)

> [!NOTE] **El problema**: 60 de los 65 proyectos analizados tienen `"main": ""` (vacío) en el `package.json` de su repositorio raíz. RedPoints utiliza un patrón de empaquetado donde `yarn dist` compila a `dist/`, copia el `package.json` dentro de `dist/`, y hace `yarn pack` desde dentro de `dist/`.
>
> **✅ RESUELTO — Opción A (Modificación Dinámica)**: Tras el `rsync` inicial, NodePi lee el `package.json` en `node_modules/<dep>/`. Si `"main"` está vacío y existe un `outDir` con `index.js`, NodePi parchea temporalmente ese `package.json` (solo la copia en `node_modules/`, nunca el fuente) para establecer `"main": "<outDir>/index.js"`. El parche se deshace durante la restauración.

---

## ⚙️ Modificaciones Aplicadas al Plan

Todas las discrepancias han sido resueltas e integradas en la documentación principal:

### ✅ Cache — `tsconfig*.json` glob aplicado

El código de `script-cache.ts` ahora usa `f.startsWith('tsconfig') && f.endsWith('.json')` para capturar todos los archivos TSConfig auxiliares (`tsconfig.build.json`, `tsconfig.base.json`, etc.).

### ✅ TSC Watch Auto-Fallback

Para paquetes TypeScript sin script `watch`, NodePi genera automáticamente `tsc -w -p ./tsconfig.build.json` (o `tsconfig.json` si es el único disponible).

### ✅ Entrypoint Patching (Opción A)

Después del `rsync`, si `"main"` está vacío en `node_modules/<dep>/package.json` y existe `<outDir>/index.js`, NodePi parchea ese `package.json` con `"main": "<outDir>/index.js"`. Solo modifica la copia en `node_modules/`, nunca el fuente.

### ✅ Arquitectura PM-Agnostic

El plan original dependía de `pnpm install` e `injected: true`, mecanismos que solo funcionan en pnpm workspaces. Se rediseñó la arquitectura para usar **rsync directo** sobre las carpetas de `node_modules/` ya instaladas por el package manager nativo del proyecto (Yarn, npm, pnpm). Ver `specs.md` §1.2 y `implementation_plan.md` §1 para la nueva especificación.
