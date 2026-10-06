import { runScenario } from './scenario.js';

await runScenario(process.argv[2], 'declared-four', process.env.FLOW_S01_WINDOW_ID);
