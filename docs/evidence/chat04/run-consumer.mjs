import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const sourcePath = 'apps/server/src/conversations/conversations.test.ts';
const generatedPath = 'apps/server/src/conversation-queue/consumer.test.ts';
const original = await readFile(sourcePath, 'utf8');
let source = original.replace("import { mkdtemp, rm }", "import { setTimeout as delay } from 'node:timers/promises';\nimport { mkdtemp, rm, writeFile }")
  .replace("from './index.js'", "from '../conversations/index.js'")
  .replace("type QueryMessage =", "import { migrateConversationQueue } from './index.js';\n\ntype QueryMessage =");
const start = source.indexOf('const databaseUrl =');
const end = source.indexOf("const ownerToken =", start);
source = source.slice(0,start)+`const databaseName = 'flow_chat04_consumer_' + process.pid + '_' + randomUUID().slice(0,8);
const adminUrl = process.env.FLOW_CHAT04_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const database = new URL(adminUrl); database.pathname = '/' + databaseName;
const databaseUrl = database.href;
const admin = new Pool({ connectionString: adminUrl, max: 1 });
`+source.slice(end);
source = source.replace("  baseUrl = await server.listen", "  await migrateConversationQueue(pool);\n  baseUrl = await server.listen");
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
    await writeFile('docs/evidence/chat04/consumer-cleanup.json', JSON.stringify({databaseName,at:new Date().toISOString(),remaining:(await lock!.query('SELECT datname FROM pg_database WHERE datname=$1',[databaseName])).rows},null,2));
  } finally { lock?.release(); await admin.end(); }
});`+source.slice(tests);
const startedAt = new Date().toISOString();
await writeFile(generatedPath,source);
try {
  const result = spawnSync('/opt/homebrew/opt/node@24/bin/node',['node_modules/vitest/vitest.mjs','run',generatedPath,'--no-cache','--configLoader','runner'],{encoding:'utf8'});
  await writeFile('docs/evidence/chat04/consumer.log',result.stdout+result.stderr);
  await writeFile('docs/evidence/chat04/consumer-result.json',JSON.stringify({sourcePath,sourceSha256:createHash('sha256').update(original).digest('hex'),generatedSha256:createHash('sha256').update(source).digest('hex'),startedAt,endedAt:new Date().toISOString(),exitCode:result.status,changes:'Only test resource setup/cleanup and explicit migration11 registration. All original test cases/assertions retained. No production index edits.'},null,2));
  process.stdout.write(result.stdout+result.stderr); process.exitCode=result.status??1;
} finally { await unlink(generatedPath); }
