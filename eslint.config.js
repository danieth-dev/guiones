// @ts-check
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Reglas de arquitectura hexagonal:
 *   ui → application → domain
 *   infrastructure → application, domain
 *   composition root (main.ts) → todo
 * El dominio no puede importar nada externo (ni librerías ni APIs del navegador vía módulos).
 */
export default tseslint.config(
  // scripts/: utilidades de Node para generar recursos (fuera del proyecto TypeScript).
  { ignores: ['dist', 'coverage', 'node_modules', 'dev-dist', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Descartar campos con desestructuración + resto ({ a: _a, ...resto }) es intencional.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain' },
        { type: 'application', pattern: 'src/application' },
        { type: 'infrastructure', pattern: 'src/infrastructure' },
        { type: 'ui', pattern: 'src/ui' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        2,
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            {
              from: { element: { type: 'application' } },
              allow: { to: { element: { types: ['application', 'domain'] } } },
            },
            {
              from: { element: { type: 'infrastructure' } },
              allow: { to: { element: { types: ['infrastructure', 'application', 'domain'] } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: ['ui', 'application', 'domain'] } } },
            },
            // src/main.ts (composition root) no pertenece a ninguna capa: puede importar todas.
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`^(?!\.{1,2}/)`,
              message: 'El dominio no depende de librerías externas: usa solo imports relativos.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
