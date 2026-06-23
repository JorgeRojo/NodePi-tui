#!/usr/bin/env bash
# Define a specific model if you want to test it (e.g., gemini-2.5-flash)
MODEL="gemini-3.5-flash"

ARGS=(--print-timeout 45s --dangerously-skip-permissions)
if [ -n "$MODEL" ]; then
  ARGS+=("--model" "$MODEL")
fi

agy "${ARGS[@]}" --print "$(cat << 'EOF'
You are an expert development assistant and a specialist in local dependency injection and synchronization flows (using NodePi).
Your goal is to deduce the exact terminal command (script) that a developer must execute in the target project to prepare/install the local environment before continuing with the injection.

Strictly follow these guidelines for the command sequence:
1. Recommend only the initial commands required to install dependencies and perform preliminary environment setup.
2. The recommended commands in the sequence must be exactly those defined in the package.json, without adding environment variable prefixes or modifying their syntax.
3. Completely exclude commands aimed at compiling the project or starting development servers.
4. Identify and add in "warnings" key alerts about required environment variables, network/VPN, local hosts, certificates, or any critical pre-requisites to configure the environment.

---
TARGET PROJECT DATA:
Name: redpoints-front-rp10
Files in root: .amazonq, .cicd, .codegraph, .dockerignore, .eslintrc, .git, .gitignore, .kiro, .prettierrc, Dockerfile, README.md, __mocks__, docker-compose.yml, index.html, jest.config.cjs, nginx.conf, package.json, public, setupTests.js, src, vite.config.js, yarn.lock

<package_json>
{
  "name": "redpoints-front-rp10",
  "scripts": {
    "add-global-translations": "mkdir -p public/translations && cp node_modules/redpoints-front-translations/frontend.translations.en.json public/translations/global.en.json",
    "build": "NODE_OPTIONS=--max-old-space-size=8192 vite build",
    "clean": "rm -Rf dist build coverage cache junit.xml",
    "conf": "git archive --remote=ssh://git@bitbucket.rdpnts.local:7999/rpcommons/redpoints-public.git master bamboo/yarn_get_config.sh | tar -xO | DIR_TO_SAVE_CONFIG_FILE=$(pwd)/public/config CONFIG_SERVER_FILES=frontcommon.yml,ipr.frontcommon.yml,ipr.portal.yml bash",
    "conf:pre": "mkdir -p public/config && curl -o public/config/config.json https://portal.ipr.pre-eu-1.redpoints.com/config/config.json",
    "install:dependencies": "yarn install:dependencies-remote && yarn add-global-translations",
    "install:dependencies-remote": "git archive --remote=ssh://git@bitbucket.rdpnts.local:7999/rpcommons/redpoints-public.git master bamboo/yarn_install_dependencies.sh | tar -xO | bash -s $bamboo_repository_branch_name",
    "lint": "eslint --max-warnings=0 'src/**/*.{js,jsx}' '**/__tests__/**/*.{js,jsx}'",
    "prettier": "prettier --config .prettierrc --write '{{src,test},__{tests,mocks}__}/**/*.{js,jsx}'",
    "preview": "HTTPS=true vite preview --open --host='portal.ipr.dev.redpoints.com' --port='8000'",
    "setup": "yarn conf && yarn install:dependencies",
    "start": "yarn conf && HTTPS=true vite --open --host='portal.ipr.dev.redpoints.com' --port='8000'",
    "start:pre": "yarn conf:pre && HTTPS=true vite --open --host='localhost.ipr.pre-eu-1.redpoints.com' --port='8001'",
    "test": "jest",
    "test:cover": "yarn test --coverage",
    "test:dev": "yarn test --watch"
  },
  "dependencies": [
    "@ant-design/icons",
    "@aws-sdk/client-qbusiness",
    "@aws-sdk/client-sts",
    "@react-sigma/core",
    "@react-sigma/layout-circular",
    "@react-sigma/layout-core",
    "@sigma/export-image",
    "@sigma/node-border",
    "@sigma/node-image",
    "actor-networks-restapi-connector",
    "antd",
    "bi-provider-restapi-connector",
    "dms-restapi-connector",
    "enumify",
    "everafter-proxy-connector",
    "extend",
    "file-type",
    "geotiff",
    "graphology",
    "graphology-layout",
    "highcharts",
    "highcharts-react-official",
    "history",
    "leaflet",
    "legalentitymapping-restapi-connector",
    "lodash",
    "mime",
    "ml-restapi-connector",
    "path-to-regexp",
    "pdfjs-dist",
    "query-string",
    "rc-segmented",
    "react",
    "react-dom",
    "react-dropzone",
    "react-hotkeys-hook",
    "react-leaflet",
    "react-redux",
    "react-redux-toastr",
    "react-router",
    "react-router-dom",
    "react-virtualized",
    "redpoints-front-actors-rp10",
    "redpoints-front-chatbot-rp10",
    "redpoints-front-common-rp10",
    "redpoints-front-configuration-rp10",
    "redpoints-front-database-rp10",
    "redpoints-front-documents-rp10",
    "redpoints-front-everafter-rp10",
    "redpoints-front-home-rp10",
    "redpoints-front-incidents-rp10",
    "redpoints-front-operations-rp10",
    "redpoints-front-reports-rp10",
    "redpoints-front-validation-rp10",
    "redpoints-restapi-connector",
    "redux",
    "redux-thunk",
    "rules-restapi-connector",
    "shortid",
    "sigma",
    "url-regex",
    "use-deep-compare-effect"
  ],
  "devDependencies": [
    "@aws-sdk/types",
    "@babel/runtime-corejs2",
    "@esbuild-plugins/node-globals-polyfill",
    "@sheerun/mutationobserver-shim",
    "@swc/jest",
    "@testing-library/dom",
    "@testing-library/jest-dom",
    "@testing-library/react",
    "@types/jest",
    "@types/react",
    "@types/react-dom",
    "@types/styled-components",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "@vitejs/plugin-basic-ssl",
    "@vitejs/plugin-react-swc",
    "babel-eslint",
    "babel-plugin-import",
    "eslint",
    "eslint-config-react-app",
    "eslint-plugin-flowtype",
    "eslint-plugin-import",
    "eslint-plugin-jest-dom",
    "eslint-plugin-jsx-a11y",
    "eslint-plugin-prettier",
    "eslint-plugin-react",
    "eslint-plugin-react-hooks",
    "eslint-plugin-simple-import-sort",
    "eslint-plugin-testing-library",
    "husky",
    "jest",
    "jest-environment-jsdom",
    "jest-junit",
    "jest-styled-components",
    "less",
    "prettier",
    "pretty-quick",
    "redpoints-front-qdeveloper-rules",
    "redpoints-front-translations",
    "redux-mock-store",
    "rollup-plugin-polyfill-node",
    "styled-components",
    "typescript",
    "vite"
  ]
}
</package_json>
---

Respond ONLY with a JSON code block enclosed in triple backticks (```json ... ```) with the following structure:

```json
{
  "projectType": "standard-vite" | "bundle-interface-module" | "other",
  "sequence": [
    {
      "command": "terminal_command",
      "description": "explanation of what this command does in 1 line"
    }
  ],
  "warnings": [
    "relevant_warning_1"
  ]
}
```

Do not add any explanatory text before or after the JSON code block.
EOF
)"
