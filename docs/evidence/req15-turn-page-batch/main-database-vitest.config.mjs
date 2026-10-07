import { mergeConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import root from '../../../vitest.config.ts';

const original = fileURLToPath(new URL('../../../apps/server/src/database.js', import.meta.url));
const donor = fileURLToPath(new URL('./main-database.ts', import.meta.url));
export default mergeConfig(root, {
  plugins: [{
    name: 'req15-main-database', enforce: 'pre',
    transform(source, id) {
      if (id !== donor) return;
      const digest = createHash('sha256').update(source).digest('hex');
      if (digest !== '277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653') throw new Error('Main database donor changed');
      console.log(`REQ15_MAIN_DATABASE_LOADED ${digest}`);
    },
    resolveId(source, importer) {
      if (importer && source.startsWith('.') && resolve(dirname(importer.split('?')[0]), source) === original) return donor;
    },
  }],
  test: { cache: false, maxWorkers: 1 },
});
