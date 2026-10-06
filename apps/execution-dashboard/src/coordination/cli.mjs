import { readFile } from 'node:fs/promises';
import { coordinationPool, initializeLedger, applyCommand, readAssignments } from './ledger.mjs';
let pool;
try {
  const [action, filename] = process.argv.slice(2);
  pool = coordinationPool();
  let result;
  if (action === 'init') { await initializeLedger(pool); result = { initialized: true }; }
  else if (action === 'list') result = await readAssignments(pool);
  else {
    if (!filename || !process.env.FLOW_COORDINATION_REPO) throw new Error('命令需要 JSON 文件与 FLOW_COORDINATION_REPO');
    result = await applyCommand(pool, { ...JSON.parse(await readFile(filename, 'utf8')), action }, process.env.FLOW_COORDINATION_REPO);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  // Never print connection strings, credentials, or driver internals.
  process.stderr.write(`${JSON.stringify({ code: error.code ?? 'UNAVAILABLE', error: error.code && ['INVALID','CONFLICT','STALE_VERSION','OWNER_MISMATCH','RELEASED','INVALID_STATE','REQUEST_CONFLICT','NOT_FOUND'].includes(error.code) ? error.message : '协调操作未确认成功；禁止新写入，按同 requestId 核对或重试。' })}\n`);
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
