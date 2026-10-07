// Owned fixture only: real database/host configuration, synthetic static Web loader.
// No public configuration, credentials, artifact or service is read at module import.
import assert from 'node:assert/strict';
import { mkdir, readFile, open } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const poolOptions = connectionString => ({ connectionString, max: 1, connectionTimeoutMillis: 1000,
  query_timeout: 1500, statement_timeout: 1250, application_name: 'flow-svc09a-owned-fixture' });

export function localAdmin(value) {
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/postgres');
  return url;
}

export async function exclusive(path, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value) + '\n');
  assert.ok(bytes.length <= 65536, 'FIXTURE_RECORD_LIMIT');
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const parent = await open(dirname(path), 'r'); try { await parent.sync(); } finally { await parent.close(); }
}

async function port() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const value = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  assert.ok(![61227, 61228].includes(value)); return value;
}

async function syntheticWeb({ input, root, checkpoint }) {
  const repo = join(input.directory, 'synthetic-web-source');
  await mkdir(repo, { mode: 0o700 });
  await mkdir(join(repo, 'apps/web'), { recursive: true, mode: 0o700 });
  await mkdir(join(repo, 'node_modules/vite'), { recursive: true, mode: 0o700 });
  const req = createRequire(join(root, 'apps/web/package.json'));
  const actualVite = JSON.parse(await readFile(req.resolve('vite/package.json'), 'utf8'));
  assert.equal(actualVite.version, '8.3.2');
  // Only version metadata for the trusted synthetic build port; no dependency copy or install.
  await exclusive(join(repo, 'node_modules/vite/package.json'), { name: 'vite', version: actualVite.version });
  await exclusive(join(repo, '.gitignore'), 'node_modules/\n');
  await exclusive(join(repo, 'apps/web/package.json'), { name: 'svc09a-synthetic-web', private: true });
  await exclusive(join(repo, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n');
  const git = args => execute('/usr/bin/git', ['-C', repo, ...args], { timeout: 2000, maxBuffer: 4096,
    env: { PATH: '/usr/bin:/bin', HOME: join(input.directory, 'home'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  await git(['init', '--quiet']); await git(['add', '.gitignore', 'apps/web/package.json', 'pnpm-lock.yaml']);
  await git(['-c', 'user.name=Flow fixture', '-c', 'user.email=fixture@invalid', 'commit', '--quiet', '-m', 'synthetic loader fixture']);
  const target = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  const load = file => import(pathToFileURL(join(root, 'tools/personal-preview', file)).href);
  const { createWebArtifactPreparer } = await load('web-artifact.mjs');
  const prepare = createWebArtifactPreparer({ build: async (_repo, outDir) => {
    await mkdir(outDir, { mode: 0o700 }); await exclusive(join(outDir, 'index.html'), '<!doctype html><title>SVC09A isolated loader</title>');
  } });
  const artifact = await prepare({ repository: repo, target, directory: input.directory });
  const reportDirectory = join(input.directory, 'SYNTHETIC_LOADER_NOT_APP_REPORT');
  await mkdir(reportDirectory, { mode: 0o700 });
  const keys = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'],
    recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
  const checks = {};
  for (const [check, names] of Object.entries(keys)) {
    const bytes = Buffer.from(JSON.stringify({ format: 1, check, backendHead: input.sourceHead, artifactId: artifact.artifactId,
      observations: Object.fromEntries(names.map(name => [name, true])) }) + '\n');
    await exclusive(join(reportDirectory, `${check}.json`), bytes); checks[check] = hash(bytes);
  }
  await exclusive(join(reportDirectory, 'report.json'), { format: 1, policy: 'flow-web-api-v1', backendHead: input.sourceHead, artifact, checks });
  const release = await load('web-release.mjs');
  const compatibilityId = await release.importWebCompatibility({ directory: input.directory, reportDirectory });
  const pointer = await release.planWebRelease({ directory: input.directory, artifact, expectedVersion: 0, action: 'bootstrap',
    backendHead: input.sourceHead, compatibilityId });
  await release.commitWebRelease(input.directory, pointer);
  await checkpoint('synthetic-web-loader', { artifact, compatibilityId, sourceHead: target,
    scope: 'SYNTHETIC_LOADER_CONTRACT_NOT_APP_COMPATIBILITY_NOT_PERSONAL', realViteBuild: false });
  return artifact;
}

export async function setupFixture({ input, root, checkpoint, adminUrl }, { nativeConfiguration } = {}) {
  const admin = localAdmin(adminUrl), databaseName = `flow_preview_${randomBytes(12).toString('hex')}`;
  const database = new URL(admin); database.pathname = '/' + databaseName;
  const config = { format: 1, installationId: randomUUID(), directory: input.directory, repository: input.repository,
    databaseName, databaseUrl: database.href, adminUrl: admin.href, ownerToken: randomBytes(32).toString('base64url'), runner: null,
    centerPort: await port(), webPort: await port(), createdAt: new Date().toISOString() };
  assert.notEqual(config.centerPort, config.webPort);
  await exclusive(join(input.directory, 'config.json'), config);
  await exclusive(join(input.directory, 'state.json'), { backendArtifact: input.artifact, source: { head: input.sourceHead, dirty: false }, processes: {}, lastError: null });
  // The trusted cold-start caller may bind fixed04da's public configuration literal;
  // default SVC09A still loads its actual slot module. No configuration comes from input JSON.
  nativeConfiguration ??= (await import(pathToFileURL(join(root, 'tools/personal-preview/runner-slots.mjs')).href)).LEGACY_NATIVE_CONFIGURATION;
  await exclusive(join(input.directory, 'claude.json'), nativeConfiguration);
  await mkdir(join(input.directory, 'runner'), { mode: 0o700 });
  await checkpoint('database-create-intent', { databaseName, installationId: config.installationId, directory: input.directory,
    centerPort: config.centerPort, webPort: config.webPort });
  const { Pool } = createRequire(join(root, 'package.json'))('pg');
  let pool = new Pool(poolOptions(config.adminUrl)), primary;
  const failures = []; let origin;
  try {
    const capacity = (await pool.query("SELECT current_setting('max_connections')::int AS maximum,(SELECT count(*)::int FROM pg_stat_activity) AS active")).rows[0];
    assert.ok(capacity.maximum - capacity.active >= 26 + 16, 'PG_CONNECTION_BUDGET_UNAVAILABLE');
    await checkpoint('pg-capacity', capacity);
    assert.equal((await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
    await pool.query(`CREATE DATABASE "${databaseName}"`);
    const rows = (await pool.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rows;
    assert.equal(rows.length, 1);
    origin = { databaseName, databaseOid: rows[0].oid, installationId: config.installationId, directory: input.directory };
    await checkpoint('database-created', origin); await pool.end(); pool = new Pool(poolOptions(config.databaseUrl));
    await pool.query('CREATE TABLE public.flow_preview_owner(installation_id uuid PRIMARY KEY,directory text NOT NULL)');
    await pool.query('INSERT INTO public.flow_preview_owner VALUES($1,$2)', [config.installationId, input.directory]);
    await checkpoint('database-marked', origin);
  } catch (error) { primary = error; }
  finally { try { await pool.end(); } catch (error) { failures.push({ name: error.name, code: error.code ?? null }); } }
  await checkpoint('setup-pool-closure', { settled: failures.length === 0, failures });
  if (primary) throw primary;
  assert.equal(failures.length, 0, 'SETUP_POOL_CLOSE_UNKNOWN');
  const webArtifact = await syntheticWeb({ input, root, checkpoint });
  return { config, origin, webArtifact };
}
