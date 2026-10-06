import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, relative } from 'node:path';
const group = process.argv[2];
const originalPath = { goals: 'apps/server/src/goals/goals.test.ts', authorization: 'apps/server/src/goal-tool-runs/authorization.test.ts', recovery: 'apps/server/src/reconciliation.test.ts', context: 'apps/server/src/conversation-context/context.test.ts' }[group];
if (!originalPath) throw new Error('Choose goals, authorization, recovery or context');
const label = process.env.FLOW_K03_RUN_LABEL;
if (!label || !/^[a-z-]+$/.test(label)) throw new Error('Run through K03 check.mjs');
const evidence = `docs/evidence/k03/${label}-consumer`;
await mkdir(evidence, { recursive: false });
const target = `apps/server/src/goal-context/generated-${group}.test.ts`;
const original = await readFile(originalPath, 'utf8'); const boundary = original.search(/(?:it|test)\('/);
if (boundary < 0) throw new Error('No test boundary');
let header = original.slice(0, boundary); const bodies = original.slice(boundary);
header = header.replace(/from '([^']+)'/g, (whole, specifier) => specifier.startsWith('.') ? `from '${relative(dirname(resolve(target)), resolve(dirname(originalPath), specifier)).replace(/^(?!\.)/, './')}'` : whole);
header = "import { migrateGoalContext } from './index.js';\n" + header;
if (group === 'goals') {
  const name = 'flow_k03_goals_' + randomUUID().replaceAll('-', '');
  header = header.replaceAll('flow_o01', name);
  header = header.replace('server = await createServer({ databaseUrl, ownerToken, leaseMs: 3000 });', 'server = await createServer({ databaseUrl, ownerToken, leaseMs: 3000 });\n  await migrateGoalContext(pool);');
  const old = `try { if (created) await lock?.query('DROP DATABASE ${name}'); }`;
  if (!header.includes(old)) throw new Error('Goal cleanup header changed');
  header = header.replace(old, `try { if (created) await lock?.query('DROP DATABASE ${name}'); await writeFile('${evidence}/cleanup.json', JSON.stringify({databaseName:'${name}',remaining:(await lock!.query('SELECT datname FROM pg_database WHERE datname=$1',['${name}'])).rows,endedAt:new Date().toISOString()})); }`);
} else if (group === 'authorization') {
  header = "import { writeFile } from 'node:fs/promises';\n" + header;
  header = header.replace('flow_o03_', 'flow_k03_authorization_');
  header = header.replace("app = await createServer({ databaseUrl, ownerToken: 'o03-owner', leaseMs });", "app = await createServer({ databaseUrl, ownerToken: 'o03-owner', leaseMs });\n  await migrateGoalContext(pool);");
  const old = 'afterAll(async () => { try { await stop(); await boss?.stop(); await pool?.end(); if (created) await admin.query(`DROP DATABASE ${name}`); } finally { await admin.end(); } });';
  if (!header.includes(old)) throw new Error('Authorization cleanup header changed');
  header = header.replace(old, 'afterAll(async () => { try { try { await stop(); } finally { try { await boss?.stop(); } finally { await pool?.end(); } } if (created) await admin.query(`DROP DATABASE ${name}`); await writeFile(\'' + evidence + '/cleanup.json\',JSON.stringify({databaseName:name,remaining:(await admin.query(\'SELECT datname FROM pg_database WHERE datname=$1\',[name])).rows,endedAt:new Date().toISOString()})); } finally { await admin.end(); } });');
} else if (group === 'context') {
  const old = "import { startContextFixture } from '../conversation-context/fixture.js';";
  if (!header.includes(old)) throw new Error('Context fixture import changed');
  header = header.replace(old, "import { startGoalContextFixture as startContextFixture } from './fixture.js';");
} else {
  header = header.replace('flow_c02_', 'flow_k03_recovery_');
  header = header.replace('server = await createServer({ databaseUrl, ownerToken, leaseMs: 800 });', 'server = await createServer({ databaseUrl, ownerToken, leaseMs: 800 });\n  const migrationPool = new Pool({connectionString:databaseUrl,max:1});\n  try { await migrateGoalContext(migrationPool); } finally { await migrationPool.end(); }');
}
const generated = header + bodies;
const hash = text => createHash('sha256').update(text).digest('hex');
const facts = { originalPath, originalSha256: hash(original), originalBodiesSha256: hash(bodies), generatedBodiesSha256: hash(generated.slice(header.length)), generatedSha256: hash(generated), generatedPath: target, startedAt: new Date().toISOString(), explicitChanges: ['Own isolated database/resource cleanup header', 'Manual migration 021 before HTTP listen; production mount not claimed', 'Relative imports rebased; original test bodies unchanged'] };
if (facts.originalBodiesSha256 !== facts.generatedBodiesSha256) throw new Error('Test bodies changed');
let created = false;
try {
  await writeFile(target, generated, { flag: 'wx' }); created = true;
  await writeFile(evidence + '/executed-source.ts.txt', generated, { flag: 'wx' });
  const args = ['node_modules/vitest/vitest.mjs', 'run', target, '--no-cache', '--configLoader', 'runner'];
  if (group === 'recovery') args.push('-t', 'requires explicit retry|does not blindly repeat|allows original work only');
  if (group === 'context') args.push('-t', 'freezes selected text privately while public prompt|claim rejects mismatched raw input|zero-context legacy');
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', timeout: 120_000, env: { ...process.env, FLOW_O01_EVIDENCE_DIR: evidence, FLOW_K02_RUN_LABEL: label + '-context-consumer', FLOW_C02_RESOURCE_EVIDENCE: evidence + '/cleanup.json' } });
  await writeFile(evidence + '/result.json', JSON.stringify({ ...facts, command: [process.execPath, ...args], endedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, error: result.error?.message }, null, 2), { flag: 'wx' });
  process.exitCode = result.status ?? 1;
} finally { if (created) await unlink(target); }
