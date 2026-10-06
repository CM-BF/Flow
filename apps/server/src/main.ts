import { createServer } from './index.js';

const databaseUrl = process.env.DATABASE_URL;
const ownerToken = process.env.FLOW_TOKEN;
if (!databaseUrl || !ownerToken) throw new Error('DATABASE_URL and FLOW_TOKEN are required.');
const port = Number(process.env.FLOW_PORT ?? 4310);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FLOW_PORT must be a valid port.');
const app = await createServer({ databaseUrl, ownerToken, ...(process.env.FLOW_ORIGIN ? { allowedOrigin: process.env.FLOW_ORIGIN } : {}) });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
try { await app.listen({ host: process.env.FLOW_HOST ?? '127.0.0.1', port }); }
catch (error) { await app.close(); throw error; }
