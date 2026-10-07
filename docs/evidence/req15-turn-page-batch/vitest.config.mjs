import { mergeConfig } from 'vitest/config';
import root from '../../../vitest.config.ts';
export default mergeConfig(root, { cacheDir: 'docs/evidence/req15-turn-page-batch/cache', test: { cache: false, maxWorkers: 1 } });
