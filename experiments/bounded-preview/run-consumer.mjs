import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const sourcePath = 'apps/server/src/conversations/conversations.test.ts';
const generatedPath = 'experiments/bounded-preview/consumer.generated.test.ts';
const original = await readFile(sourcePath, 'utf8');
let source = original.replace("import { mkdtemp, rm }", "import { setTimeout as delay } from 'node:timers/promises';\nimport { mkdtemp, rm, writeFile }");
source = source.replace(/(from ['"])(\.[^'"]+)(['"])/g, (_match, before, specifier, after) => {
  const target = resolve(dirname(sourcePath), specifier);
  const adjusted = relative(dirname(resolve(generatedPath)), target);
  return before + (adjusted.startsWith('.') ? adjusted : './' + adjusted) + after;
}).replace("from '@flow/contracts'", "from '../../packages/contracts/src/index.js'");
const start = source.indexOf('const databaseUrl =');
const end = source.indexOf("const ownerToken =", start);
source = source.slice(0,start)+`const databaseName = 'flow_b03_consumer_' + process.pid + '_' + randomUUID().slice(0,8);
const adminUrl = process.env.FLOW_B03_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const database = new URL(adminUrl); database.pathname = '/' + databaseName;
const databaseUrl = database.href;
const admin = new Pool({ connectionString: adminUrl, max: 1 });
`+source.slice(end);
const setup = source.indexOf('beforeAll(async () => {');
const tests = source.indexOf('\n\nit(', setup);
source = source.slice(0,setup)+`beforeAll(async () => {
  lock = await admin.connect();
  if ((await lock.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) throw new Error('Refusing existing database.');
  await lock.query('CREATE DATABASE "'+databaseName+'"'); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 8, statement_timeout: 5000 });
  await startServer();
});
afterAll(async () => {
  try { await stopServer(); await pool?.end();
    if (created) {
      const deadline = performance.now()+5000;
      while (Number((await lock!.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1',[databaseName])).rows[0].count)) {
        if (performance.now()>deadline) throw new Error('Own consumer database still active.');
        await delay(25);
      }
      await lock!.query('DROP DATABASE "'+databaseName+'"');
    }
    await writeFile('docs/evidence/b03/consumer-cleanup.json', JSON.stringify({databaseName,at:new Date().toISOString(),remaining:(await lock!.query('SELECT datname FROM pg_database WHERE datname=$1',[databaseName])).rows},null,2));
  } finally { lock?.release(); await admin.end(); }
});`+source.slice(tests);
const originalBodies = original.slice(original.indexOf('\n\nit(', original.indexOf('beforeAll(async () => {'))));
const generatedBodies = source.slice(source.indexOf('\n\nit(', source.indexOf('beforeAll(async () => {'))));
if (originalBodies !== generatedBodies) throw new Error('Original consumer test bodies changed.');
const startedAt = new Date().toISOString();
await writeFile(generatedPath,source);
try {
  const result = spawnSync('/opt/homebrew/opt/node@24/bin/node',['node_modules/vitest/vitest.mjs','run',generatedPath,'--no-cache','--configLoader','runner','--config','experiments/bounded-preview/vitest.consumer.config.ts'],{encoding:'utf8',timeout:60000});
  await writeFile('docs/evidence/b03/consumer.log',result.stdout+result.stderr);
  await writeFile('docs/evidence/b03/consumer-result.json',JSON.stringify({command:['/opt/homebrew/opt/node@24/bin/node','node_modules/vitest/vitest.mjs','run',generatedPath,'--no-cache','--configLoader','runner','--config','experiments/bounded-preview/vitest.consumer.config.ts'],testBodiesSha256:createHash('sha256').update(originalBodies).digest('hex'),sourcePath,sourceSha256:createHash('sha256').update(original).digest('hex'),generatedSha256:createHash('sha256').update(source).digest('hex'),startedAt,endedAt:new Date().toISOString(),exitCode:result.status,changes:'Only relative imports and unique test resource setup/cleanup. All original test cases/assertions retained. No production index edits.'},null,2));
  process.stdout.write(result.stdout+result.stderr); process.exitCode=result.status??1;
} finally { await unlink(generatedPath); }
