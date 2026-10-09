import { defineConfig } from 'vitest/config';

// Separate database so this suite can run in parallel with packages/db tests.
process.env.TEST_DATABASE_URL ??= 'postgresql://sp:sp@localhost:5432/skills_passport_test_api';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], globalSetup: ['../../packages/db/test/global-setup.ts'], fileParallelism: false, testTimeout: 60_000, hookTimeout: 120_000 },
  esbuild: { target: 'es2022' },
});
