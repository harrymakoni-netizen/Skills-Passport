// Creates .env from .env.example with fresh random secrets. Usage: pnpm setup:env [--fs]
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

if (existsSync('.env') && !process.argv.includes('--force')) {
  console.log('.env already exists (use --force to overwrite)');
  process.exit(0);
}
let env = readFileSync('.env.example', 'utf8');
const set = (k, v) => (env = env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`));
set('PII_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
set('PHONE_HASH_PEPPER', randomBytes(32).toString('hex'));
set('JWT_SECRET', randomBytes(32).toString('hex'));
if (process.argv.includes('--fs')) set('STORAGE_DRIVER', 'fs');
writeFileSync('.env', env);
console.log('Wrote .env with fresh secrets');
