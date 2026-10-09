import { execSync } from 'node:child_process';
import { join } from 'node:path';

/** Integration tests run against a separate database (TEST_DATABASE_URL), migrated before the run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://sp:sp@localhost:5432/skills_passport_test';
  process.env.DATABASE_URL = url;
  execSync('npx prisma migrate deploy', { cwd: join(import.meta.dirname, '..'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
