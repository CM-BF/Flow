import { createDashboardServer } from '../../../../apps/execution-dashboard/src/server.mjs';
import { humanOverview } from '../../../../apps/execution-dashboard/src/human.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Real static renderer, synthetic empty management snapshot: no ledger, Git aggregation or product API. */
export async function startPreview() {
  const server = createDashboardServer({ mainWorktree: root, fallbackWorktree: root, frozenCommit: 'aeb764e5d2c2ec043ae8673cde2724f5330db2ab', staleAfterHours: 24, tasks: [] });
  const [serveStatic] = server.listeners('request'); server.removeAllListeners('request');
  server.on('request', (request, response) => {
    if (request.url === '/api/snapshot') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ generatedAt: new Date().toISOString(), main: { available: false }, tasks: [], assignments: { state: 'unavailable', claims: [] }, unregisteredAssignments: [], overview: humanOverview([]), milestones: { taskId: null, current: false, todos: [] } }));
    } else serveStatic(request, response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { base: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const preview = await startPreview(); console.log(preview.base);
  const stop = async () => { await preview.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
