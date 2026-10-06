import { mergeConfig } from 'vitest/config';
import config from './vitest.config.mjs';
export default mergeConfig(config, { test: { include: ['docs/evidence/svc07/http-consumer.test.ts'], testTimeout: 25000, hookTimeout: 20000 } });
