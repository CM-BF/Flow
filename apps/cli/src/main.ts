import { runCli } from './index.js';

const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
process.exitCode = await runCli(process.argv.slice(2), undefined, process.env, controller.signal);
process.removeListener('SIGINT', stop);
process.removeListener('SIGTERM', stop);
