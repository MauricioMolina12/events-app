// @ts-check
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config, consumed by `ng lint` through the `@angular-eslint/builder:lint`
 * target declared in `angular.json`.
 *
 * Only the `recommended` sets are on: linting is **not** type-aware (no `projectService`),
 * which keeps `ng lint` fast enough to live in a pre-commit hook. Templates are checked
 * twice — `templateAccessibility` (WCAG) and the inline templates of decorated components.
 *
 * `scripts/i18n-audit.mjs` is deliberately out of scope: Prettier formats it and every rule
 * of value there needs the TypeScript parser, which only kicks in for TypeScript files.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended, angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // No stray debug logging ships to production. The two intentional call sites
      // (bootstrap failure in `main.ts`, the app logger) carry an explicit disable.
      'no-console': 'error',
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
);
