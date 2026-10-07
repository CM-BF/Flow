import baseline from '../../../vitest.config.ts';
import { fileURLToPath } from 'node:url';

export default {
  ...baseline,
  cacheDir: fileURLToPath(new URL('./cache', import.meta.url)),
  test: { ...baseline.test, cache: false, maxWorkers: 1 },
};
