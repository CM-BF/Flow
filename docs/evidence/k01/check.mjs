import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const [label, ...args] = process.argv.slice(2);
if (!label || !/^[a-z-]+$/.test(label) || !args.length) throw new Error('Usage: check.mjs label command args');
const startedAt = new Date().toISOString();
const paths = ['apps/server/src/knowledge/index.ts', 'apps/server/src/knowledge/storage.ts', 'apps/server/src/knowledge/search.ts', 'apps/server/src/knowledge/text.ts', 'apps/server/src/knowledge/knowledge.test.ts', 'apps/server/src/knowledge/fixture.ts', 'packages/contracts/src/knowledge.ts', 'packages/storage/migrations/015-knowledge-sources.sql', 'docs/evidence/k01/check.mjs'];
const sourceFiles = await Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const log = createWriteStream(`docs/evidence/k01/${label}.log`);
const child = spawn(args[0], args.slice(1), { env: { ...process.env, FLOW_K01_RUN_LABEL: label }, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
child.on('error', error => { process.stderr.write(error.message); });
child.on('close', async (exitCode, signal) => {
  log.end();
  await writeFile(`docs/evidence/k01/${label}-result.json`, JSON.stringify({ command: args, sourceFiles, startedAt, endedAt: new Date().toISOString(), exitCode, signal }, null, 2));
  process.stdout.write(JSON.stringify({ label, exitCode, signal }) + '\n'); process.exitCode = exitCode ?? 1;
});
