import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'docs/**', '**/*.d.ts', 'spikes/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // core is shared with the in-game importer: it must stay free of DOM and Phaser.
    files: ['packages/core/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'HTMLElement',
        'HTMLCanvasElement',
        'ImageData',
        'localStorage',
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'phaser/*', '@pokerpg/slicer', '@pokerpg/game'] },
      ],
    },
  },
  prettier,
);
