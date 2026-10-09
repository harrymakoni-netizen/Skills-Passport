import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**', '**/next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@prisma/*', '@nestjs/*', 'ioredis', 'bullmq', 'node:fs', 'fs', 'next', 'next/*', 'react'] }],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.mjs', '**/scripts/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/scripts/**', '**/seed*.ts', '**/*.config.*'],
    rules: { 'no-console': 'off' },
  },
);
