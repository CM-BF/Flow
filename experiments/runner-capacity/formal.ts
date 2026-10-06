import { runScenario } from './scenario.js';

await runScenario(process.argv[2], { id: 'four-processes', tasks: 16, runners: 4, conversations: 128, formal: true, windowId: process.env.FLOW_S01_WINDOW_ID });
