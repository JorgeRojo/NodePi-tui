# Análisis: ¿Debería NodePi detectar `redpoints-front-rp10`?

## 1. Resultado de `pnpm dev`

El comando falló con código de salida 1:

```
[ERR_PNPM_FETCH_404] GET https://registry.npmjs.org/redpoints-front-translations: Not Found - 404
```

> [!WARNING] `pnpm install` (ejecutado automáticamente por `pnpm dev` al detectar que faltan dependencias) intenta descargar paquetes privados de RedPoints (`redpoints-front-translations`, y presumiblemente muchos otros `redpoints-*`) desde el registry público de npm, donde no existen. Este proyecto requiere un **registry privado corporativo** (`nexus.rdpnts.com`) configurado en un `.npmrc` local o en un `yarn.lock` ya resuelto con yarn.

---

## 2. Estructura del Proyecto

| Señal                                     | Presente | Fichero / Evidencia                                                                                                          |
| :---------------------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.js`                          |    ✅    | [vite.config.js](file:///Users/jorge/projects/frontend-repos/redpoints-front-rp10/vite.config.js)                            |
| `vite` en devDependencies                 |    ✅    | `"vite": "4.1.0"` en [package.json L124](file:///Users/jorge/projects/frontend-repos/redpoints-front-rp10/package.json#L124) |
| `@vitejs/plugin-react-swc`                |    ✅    | [package.json L96](file:///Users/jorge/projects/frontend-repos/redpoints-front-rp10/package.json#L96)                        |
| `index.html` con `<script type="module">` |    ✅    | [index.html](file:///Users/jorge/projects/frontend-repos/redpoints-front-rp10/index.html)                                    |
| Script `start` usa `vite`                 |    ✅    | `"start": "yarn conf && HTTPS=true vite --open ..."`                                                                         |
| Script `build` usa `vite build`           |    ✅    | `"build": "NODE_OPTIONS=... vite build"`                                                                                     |
| `yarn.lock`                               |    ✅    | 380 KB                                                                                                                       |
| `package-lock.json` / `pnpm-lock.yaml`    |    ❌    | Solo yarn                                                                                                                    |

---

## 3. Veredicto: ¿Debería ser detectado por NodePi?

### **SÍ, absolutamente.** Este es un proyecto Vite nativo.

La detección de Vite en [preflight.ts](file:///Users/jorge/projects/NodePi-tui/src/core/preflight.ts#L102-L120) busca archivos `vite.config.{ts,js,mjs,cjs,mts}` en el directorio raíz. `redpoints-front-rp10` tiene un [vite.config.js](file:///Users/jorge/projects/frontend-repos/redpoints-front-rp10/vite.config.js) y por lo tanto sería **correctamente detectado como proyecto Vite** por el Preflight actual.

---

## 4. Diferencias Clave con los Módulos Aislados (ej. `documents-rp10`)

Este proyecto es **radicalmente diferente** a los módulos aislados analizados anteriormente:

| Característica        | `redpoints-front-rp10` (Portal Shell)                                  | `redpoints-front-documents-rp10` (Módulo Aislado)               |
| :-------------------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------- |
| **Rol**               | Aplicación principal (Portal)                                          | Sub-módulo aislado (plugin)                                     |
| **`private`**         | `true` — No se publica en npm                                          | `false` (via `"publishConfig"`) — Se publica como paquete       |
| **`vite.config`**     | Nativo, propio, commitado en Git                                       | Inyectado dinámicamente por `install-devApp`, en `.gitignore`   |
| **Dependencias RP10** | Importa **todos** los módulos aislados como dependencias de producción | Solo se importa a sí mismo (self-referencing vía aliases)       |
| **`install-devApp`**  | NO lo usa — es autosuficiente                                          | Lo usa — necesita el cascarón de `bundle-interface`             |
| **`yarn dist`**       | NO tiene — compila con `vite build` para deploy                        | Sí tiene — compila bundles modulares con `vite-build-bundle.js` |
| **Acciones Redux**    | Usa las de todos los módulos importados                                | Declara las suyas con prefijo (ej. `DOCUMENTS_REPOSITORY@`)     |

### Diagrama de relación:

```mermaid
graph LR
    Portal["redpoints-front-rp10<br/>(Portal Shell)"]
    Docs["documents-rp10"]
    Home["home-rp10"]
    Inc["incidents-rp10"]
    Common["common-rp10"]
    Bundle["bundle-interface-rp10"]

    Portal -->|importa| Docs
    Portal -->|importa| Home
    Portal -->|importa| Inc
    Portal -->|importa| Common

    Docs -.->|install-devApp| Bundle
    Home -.->|install-devApp| Bundle
    Inc -.->|install-devApp| Bundle

    style Portal fill:#2563eb,color:#fff,stroke:#1d4ed8
    style Bundle fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Docs fill:#059669,color:#fff
    style Home fill:#059669,color:#fff
    style Inc fill:#059669,color:#fff
    style Common fill:#d97706,color:#fff
```

---

## 5. Implicaciones para NodePi

### Lo que funciona bien hoy:

- ✅ **Detección Vite**: El `preflight.ts` lo detectaría correctamente.
- ✅ **Wrapper Vite HMR**: El [execution.ts](file:///Users/jorge/projects/NodePi-tui/src/core/execution.ts#L82-L131) puede inyectar el wrapper de HMR para forzar la recarga en caliente de dependencias locales dentro de `node_modules`.

### Consideraciones especiales del Portal Shell:

1. **Muchas dependencias locales potenciales**: Este proyecto importa ~12 módulos `redpoints-front-*-rp10`. Si el desarrollador tiene varios de estos clonados localmente, NodePi necesitará descubrir y sincronizar **muchas** dependencias intermedias simultáneamente.
2. **No usa `install-devApp`**: La configuración de Vite es propia, no inyectada. NodePi no necesita preocuparse por conflictos de ficheros de `bundle-interface`.
3. **Yarn-only**: El proyecto usa exclusivamente `yarn.lock`. El aviso de colisión de lockfiles en el Preflight se disparará siempre al intentar usar `pnpm install`.
4. **Registry privado**: La inyección `pnpm install` fallará si no se configura el registry corporativo previamente (como vimos en el error del comando).
