import { createDashboardServer } from '../../../apps/execution-dashboard/src/server.mjs';
import { defaultRegistry } from '../../../apps/execution-dashboard/src/registry.mjs';
const server = createDashboardServer(defaultRegistry());
server.listen(0, '127.0.0.1', () => console.log(`D06 fixed-source preview http://127.0.0.1:${server.address().port}/#architecture`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
