import { open, lstat, realpath, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inspectOwnedProcess, ownsListener } from '../../../../tools/personal-preview/process.mjs';
import { readWebRelease, currentWebArtifact, findWebCompatibility, verifyWebCompatibility } from '../../../../tools/personal-preview/web-release.mjs';
import { verifyWebArtifact } from '../../../../tools/personal-preview/web-artifact.mjs';

const root = '/Users/citrine/.flow-personal';
const repository = '/Users/citrine/Projects/AgentHarness/Flow';
const target = '362af3bac77541e5a60979326bcf4d4b8c947915';
const output = join(dirname(fileURLToPath(import.meta.url)), 'run-svc05h-same-web-recovery-20261006-1835/facts-after.json');
const sha = b => createHash('sha256').update(b).digest('hex');
const execute = promisify(execFile);
const facts = { observedAt: new Date().toISOString(), mode: 'read-only Web recovery after-observation', target, personalMutations: 0, httpRequests: 0, providerQueries: 0, files: {}, limits: ['Instant local observations; no future user-work guarantee.', 'No personal HTTP, token, user body, process arguments or SQL body is reported.', 'Socket counts do not establish the personal failure cause.'] };
let pool; let phase = 'private-files';
async function bounded(path, max = 65536) {
  const f = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const st = await f.stat();
    if (!st.isFile() || st.uid !== process.getuid() || st.size > max) throw Error('FILE_IDENTITY');
    const b = Buffer.alloc(max + 1); let count = 0;
    while (count < b.length) { const { bytesRead } = await f.read(b, count, b.length - count, null); if (!bytesRead) break; count += bytesRead; }
    if (count > max) throw Error('FILE_BOUND');
    return { bytes: b.subarray(0, count), stat: st };
  } finally { await f.close(); }
}
async function command(cmd, args) {
  try { const r = await execute(cmd, args, { timeout: 2000, maxBuffer: 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } }); return { code: 0, stdout: r.stdout }; }
  catch (e) { return { code: typeof e.code === 'number' ? e.code : 'UNKNOWN', stdout: e.stdout ?? '' }; }
}
try {
  const st = await lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink() || st.mode & 0o077 || await realpath(root) !== root) throw Error('ROOT_IDENTITY');
  const values = {};
  for (const name of ['config.json', 'claude.json', 'state.json', 'maintenance.json', 'web-release.json']) {
    const { bytes, stat } = await bounded(join(root, name));
    if ((stat.mode & 0o777) !== 0o600) throw Error('PRIVATE_MODE');
    values[name] = JSON.parse(bytes);
    facts.files[name] = { bytes: bytes.length, sha256: sha(bytes), mode: stat.mode & 0o777, dev: stat.dev, ino: stat.ino };
  }
  const config = values['config.json']; const state = values['state.json']; const op = values['maintenance.json'];
  if (config.directory !== root || config.repository !== repository || !/^flow_preview_[a-f0-9]{24}$/.test(config.databaseName)) throw Error('CONFIG_IDENTITY');
  const db = new URL(config.databaseUrl);
  if (db.hostname !== '127.0.0.1' || db.pathname !== '/' + config.databaseName) throw Error('LOCAL_DB_IDENTITY');
  facts.config = { installationId: config.installationId, repository, directory: root, databaseName: config.databaseName, runnerId: config.runner.runnerId, centerPort: config.centerPort, webPort: config.webPort };
  facts.runtimeSource = state.source;
  facts.operation = { operationId: op.operationId, phase: op.phase, target: op.target, resumeVersion: op.resumeVersion };
  facts.operationLock = await lstat(join(root, 'operation.lock')).then(() => 'present', e => e.code === 'ENOENT' ? 'absent' : 'unknown');
  const head = await command('git', ['-C', repository, 'rev-parse', 'HEAD']); const dirty = await command('git', ['-C', repository, 'status', '--porcelain']);
  facts.checkout = { head: head.stdout.trim(), dirty: dirty.stdout.length !== 0, confirmed: head.code === 0 && dirty.code === 0 };
  phase = 'processes';
  const ps = await command('ps', ['-axo', 'pid=,ppid=,pgid=,comm=']);
  if (ps.code !== 0) throw Error('PROCESS_LIST_UNKNOWN');
  const rows = ps.stdout.split('\n').flatMap(line => { const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line); return m ? [{ pid: +m[1], parent: +m[2], group: +m[3], executable: m[4] }] : []; });
  facts.processes = {};
  for (const role of ['center', 'runner', 'web']) {
    const record = state.processes[role]; const members = [];
    for (const row of rows.filter(r => r.group === record.group)) {
      const cwd = await command('lsof', ['-a', '-p', String(row.pid), '-d', 'cwd', '-Fn']);
      const sockets = await command('lsof', ['-nP', '-a', '-p', String(row.pid), '-iTCP', '-FPT']);
      const states = {};
      for (const line of sockets.stdout.split('\n')) if (line.startsWith('TST=')) states[line.slice(4)] = (states[line.slice(4)] ?? 0) + 1;
      members.push({ ...row, cwd: cwd.code === 0 ? cwd.stdout.split('\n').find(x => x.startsWith('n'))?.slice(1) ?? null : null, socketObservationCode: sockets.code, tcpStates: states });
    }
    facts.processes[role] = { pid: record.pid, group: record.group, startedAt: record.startedAt, identity: await inspectOwnedProcess(record), members };
  }
  facts.listeners = { center: await ownsListener(state.processes.center, config.centerPort), web: await ownsListener(state.processes.web, config.webPort) };
  phase = 'artifacts-reports';
  const release = await readWebRelease(root); if (!release || release.version !== 2 || release.backendHead !== 'b1c2e39837c2208e6fc2c59a80e16797f26448b5' || state.source?.head !== target || state.source?.dirty !== false) throw Error('RELEASE_IDENTITY');
  facts.release = release; facts.current = currentWebArtifact(release); facts.retained = [];
  for (const artifact of release.artifacts) {
    const verified = await verifyWebArtifact({ directory: root, artifact });
    const reportId = await findWebCompatibility({ directory: root, artifact, backendHead: target });
    const reportFiles = {};
    for (const name of ['report', 'read', 'send', 'recover', 'negotiation']) {
      const { bytes } = await bounded(join(root, 'web-compatibility', reportId, name + '.json'), 4096);
      reportFiles[name] = { bytes: bytes.length, sha256: sha(bytes) };
    }
    const pointerReportId = release.compatibilityIds[artifact.artifactId];
    await verifyWebCompatibility({ directory: root, artifact, backendHead: release.backendHead, compatibilityId: pointerReportId });
    const pointerReportFiles = {};
    for (const name of ['report', 'read', 'send', 'recover', 'negotiation']) { const { bytes } = await bounded(join(root, 'web-compatibility', pointerReportId, name + '.json'), 4096); pointerReportFiles[name] = { bytes: bytes.length, sha256: sha(bytes) }; }
    facts.retained.push({ artifact, files: verified.manifest.files.length, bytes: verified.manifest.totalBytes, verified: true, bootstrapReportBackend: target, reportId, reportFiles, pointerReportBackend: release.backendHead, pointerReportId, pointerReportFiles });
  }
  phase = 'marker-and-unchanged-records';
  const require = createRequire(new URL('../../../../package.json', import.meta.url));
  const { Pool } = require('pg'); facts.pgEntry = require.resolve('pg');
  pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, application_name: 'svc05h-web-recovery-readonly' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows = async (sql, p) => (await c.query(sql, p)).rows;
    const marker = await rows('SELECT installation_id,directory FROM public.flow_preview_owner');
    if (marker.length !== 1 || marker[0].installation_id !== config.installationId || marker[0].directory !== root) throw Error('MARKER');
    facts.database = { markerMatched: true, marker, runnerIdentityMatched: (await rows('SELECT id FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [config.runner.runnerId, sha(config.runner.token)])).length === 1,
      runner: await rows('SELECT id,maintenance_state,maintenance_version,maintenance_operation_id FROM flow.runners WHERE id=$1', [config.runner.runnerId]),
      tasks: await rows('SELECT id,status,current_attempt_id,updated_at FROM flow.tasks ORDER BY id LIMIT 1001'),
      queue: await rows('SELECT state,count(*)::int AS count FROM flow.conversation_queue GROUP BY state ORDER BY state'),
      unfinishedCount: (await rows('SELECT count(*)::int AS count FROM flow.attempts WHERE completed_at IS NULL'))[0].count,
      retainedConversation: await rows('SELECT id,revision FROM flow.conversations WHERE id=$1', ['2c507833-67fe-4d10-acf5-6c97eedd05bb']) };
    if (facts.database.tasks.length > 1000) throw Error('ROW_BOUND');
    await c.query('COMMIT');
  } finally { c.release(); }
  facts.outcome = 'observed';
} catch (e) { facts.outcome = 'unknown'; facts.phase = phase; facts.errorCode = /^[A-Z0-9_]+$/.test(e.code ?? '') ? e.code : String(e.message ?? 'UNKNOWN').match(/^[A-Z0-9_]+$/)?.[0] ?? 'OBSERVATION_UNKNOWN'; process.exitCode = 1; }
finally { await pool?.end(); }
await mkdir(dirname(output), { recursive: true });
const f = await open(output, 'wx', 0o600); try { await f.writeFile(JSON.stringify(facts, null, 2) + '\n'); await f.sync(); } finally { await f.close(); }
console.log(JSON.stringify({ outcome: facts.outcome, phase: facts.phase, errorCode: facts.errorCode, runtimeSource: facts.runtimeSource, releaseVersion: facts.release?.version, processIdentities: Object.fromEntries(Object.entries(facts.processes ?? {}).map(([k, v]) => [k, v.identity])), file: output }));
