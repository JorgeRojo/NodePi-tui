import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fixupConfigRules } from '@eslint/compat';
import importPlugin from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import configPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...fixupConfigRules([
    {
      files: ['**/*.ts'],
      plugins: {
        import: importPlugin,
        'import-x': importPlugin,
      },
      languageOptions: {
        parser: tseslint.parser,
      },
      settings: {
        'import/resolver-next': [
          createTypeScriptImportResolver({
            alwaysTryTypes: true,
            project: './tsconfig.json',
          }),
        ],
        'import-x/resolver-next': [
          createTypeScriptImportResolver({
            alwaysTryTypes: true,
            project: './tsconfig.json',
          }),
        ],
      },
      rules: {
        ...importPlugin.configs.recommended.rules,
      },
    },
  ]),
  {
    files: ['**/*.ts'],
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    settings: {
      'import/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json',
        }),
      ],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json',
        }),
      ],
    },
    rules: {
      // General
      'no-console': 'off',
      'no-unused-expressions': 'off',
      'padded-blocks': 'off',
      'no-tabs': 'off',
      indent: 'off',
      'no-new-object': 'off',
      'no-redeclare': 'off',
      'no-use-before-define': 'off',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-array-constructor': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowedNames: ['mapStateToProps'] },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // Unused vars handled by unused-imports
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Import sort
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^vitest', '^@?\\w'],
            ['^src/'],
            ['^\\.\\./', '^\\./', '\\./[A-Z]', '^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'import/first': 'error',
      'import/no-duplicates': ['error', { 'prefer-inline': false }],
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    },
  },
  {
    files: ['**/__tests__/**/*.ts', '**/*.{spec,test}.ts'],
    rules: {
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  configPrettier
);
