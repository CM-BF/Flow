import { createDashboardServer } from '../../../../apps/execution-dashboard/src/server.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
// Static architecture verification has no live registry or coordination-DB input.
const server = createDashboardServer({ mainWorktree: root, fallbackWorktree: root, frozenCommit: '9c6fa9b100f04916f43b04280f05f497b28eeb0f', staleAfterHours: 24, tasks: [] });
server.listen(0, '127.0.0.1', () => console.log(`D06 fixed architecture preview http://127.0.0.1:${server.address().port}/#architecture`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
