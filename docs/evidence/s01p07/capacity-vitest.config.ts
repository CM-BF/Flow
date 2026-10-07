import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import base from './pg-vitest.config.ts';

const databaseId = fileURLToPath(new URL('../../../apps/server/src/database.ts', import.meta.url));
const donor = new URL('./main-database.ts', import.meta.url);
const sha256 = '277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653';
export default {
  ...base,
  plugins: [{ name: 'fixed-main-database', enforce: 'pre' as const, load(id: string) {
    if (id.split('?')[0] !== databaseId) return;
    const code = readFileSync(donor);
    if (createHash('sha256').update(code).digest('hex') !== sha256) throw new Error('Fixed main database input changed.');
    // Preserve the production module id, including its migration import.meta.url base.
    return code.toString('utf8') + `\nprocess.env.FLOW_S01P07_MAIN_DATABASE_LOADED_SHA = '${sha256}';\n`;
  } }],
  test: { ...base.test, include: ['apps/runner/src/runtime-capacity.test.ts'], testNamePattern: '^real PG/HTTP ' },
};
