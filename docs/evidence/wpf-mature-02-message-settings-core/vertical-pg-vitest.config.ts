import pure from './vertical-vitest.config.js';

// This separate config requires the approved dedicated PG window and explicit environment.
export default { ...pure, test: { ...pure.test, include: ['apps/server/src/conversations/message-settings.test.ts'] } };
