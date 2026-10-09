import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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
    files: ['**/scripts/**', '**/seed*.ts', '**/*.config.*'],
    rules: { 'no-console': 'off' },
  },
);
