import { runScenario } from './scenario.js';

await runScenario(process.argv[2], 'four-processes', process.env.FLOW_S01_WINDOW_ID);
