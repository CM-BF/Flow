/** Test process entry: real center factory + X05 module, no provider/model. */
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { createServer } from '../index.js';
import { migratePackageFetches, registerPackageFetchRoutes, startPackageFetchWorker } from './index.js';

const config = JSON.parse(await readFile(process.argv[2]!, 'utf8'));
const pool = new Pool({ connectionString: config.databaseUrl, max: 3 });
const app = await createServer({ databaseUrl: config.databaseUrl, ownerToken: config.ownerToken });
await migratePackageFetches(pool);
if (!app.hasRoute({ method: 'GET', url: '/api/package-fetches/:id' })) registerPackageFetchRoutes(app, pool, config.host);
const worker = config.worker === false ? null : await startPackageFetchWorker(pool, config.host);
const address = await app.listen({ host: '127.0.0.1', port: 0 });
process.stdout.write(JSON.stringify({ ready: true, address, pid: process.pid }) + '\n');
let closing: Promise<void> | null = null;
const close = () => closing ??= (async () => {
  await worker?.stop(); await app.close(); await pool.end();
})().catch(() => { process.stderr.write('Fixture center shutdown failed.\n'); process.exitCode = 1; });
process.once('SIGTERM', close); process.once('SIGINT', close);
