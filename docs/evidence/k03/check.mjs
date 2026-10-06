import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const [label, ...args] = process.argv.slice(2);
if (!label || !/^[a-z-]+$/.test(label) || !args.length) throw new Error('Usage: check.mjs label command args');
const startedAt = new Date().toISOString();
const receipt = JSON.parse(await readFile('docs/evidence/k03/reconciliation-handoff-receipt.json', 'utf8'));
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...receipt.claim.scope], { encoding: 'utf8' }).trim().split('\n'))].filter(path => /\.(?:ts|sql|mjs)$/.test(path)).sort();
const sourceFiles = await Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const log = createWriteStream(`docs/evidence/k03/${label}.log`);
const child = spawn(args[0], args.slice(1), { env: { ...process.env, FLOW_K03_RUN_LABEL: label }, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
child.on('error', error => { process.stderr.write(error.message); });
child.on('close', async (exitCode, signal) => {
  log.end();
  await writeFile(`docs/evidence/k03/${label}-result.json`, JSON.stringify({ command: args, sourceFiles, startedAt, endedAt: new Date().toISOString(), exitCode, signal }, null, 2));
  process.stdout.write(JSON.stringify({ label, exitCode, signal }) + '\n'); process.exitCode = exitCode ?? 1;
});
