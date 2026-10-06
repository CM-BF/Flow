import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareWebArtifact } from './web-artifact.mjs';
import { startStaticWeb } from './static-web.mjs';
const execute = promisify(execFile);
const installedWeb = fileURLToPath(new URL('../../apps/web/node_modules', import.meta.url));
const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
test('serves fixed bytes with no HMR, preserves same-origin authorization and streams SSE before completion', async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc03-static-')));
  const repository = join(parent, 'repo'); const directory = join(parent, 'state');
  const seen = []; let finishStream;
  const center = createServer((request, response) => {
    seen.push({ url: request.url, authorization: request.headers.authorization, origin: request.headers.origin });
    if (request.url === '/api/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream' }); response.write('id: 1\ndata: first\n\n');
      finishStream = () => response.end('id: 2\ndata: final\n\n');
    } else response.end(JSON.stringify({ ok: request.headers.authorization === 'Bearer synthetic-owner' }));
  });
  const centerPort = await listen(center); const reservation = createServer(); const webPort = await listen(reservation); await close(reservation);
  let staticWeb;
  try {
    await mkdir(join(repository, 'apps/web'), { recursive: true }); await mkdir(directory, { mode: 0o700 });
    await writeFile(join(repository, '.gitignore'), 'node_modules\n'); await writeFile(join(repository, 'pnpm-lock.yaml'), 'fixture');
    await writeFile(join(repository, 'apps/web/package.json'), '{"type":"module"}');
    await writeFile(join(repository, 'apps/web/index.html'), '<html><body>version one</body></html>');
    await symlink(installedWeb, join(repository, 'apps/web/node_modules'));
    await execute('git', ['init', '-q', repository]); await execute('git', ['-C', repository, 'add', '.']);
    await execute('git', ['-C', repository, '-c', 'user.name=Flow Test', '-c', 'user.email=flow-test@example.invalid', 'commit', '-qm', 'one']);
    const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
    const artifact = await prepareWebArtifact({ directory, repository, target });
    staticWeb = await startStaticWeb({ directory, repository, webPort, centerPort, artifact });
    const url = `http://127.0.0.1:${webPort}`;
    const first = await (await fetch(url)).text(); assert.ok(first.includes('version one')); assert.ok(!first.includes('/@vite/client'));
    await writeFile(join(repository, 'apps/web/index.html'), '<html>version two</html>');
    assert.equal(await (await fetch(url)).text(), first);
    assert.deepEqual(await (await fetch(`${url}/__flow_preview_identity`)).json(), artifact);
    assert.equal((await fetch(`${url}/__flow_preview_identity`)).headers.get('cache-control'), 'no-store');
    const headers = { authorization: 'Bearer synthetic-owner', origin: url };
    assert.deepEqual(await (await fetch(`${url}/api/check`, { headers })).json(), { ok: true });
    const abort = new AbortController(); const deadline = setTimeout(() => abort.abort(), 3000);
    try {
      const response = await fetch(`${url}/api/events`, { headers, signal: abort.signal }); const reader = response.body.getReader();
      const firstChunk = new TextDecoder().decode((await reader.read()).value);
      assert.equal(firstChunk, 'id: 1\ndata: first\n\n');
      finishStream(); assert.equal(new TextDecoder().decode((await reader.read()).value), 'id: 2\ndata: final\n\n');
      await reader.cancel();
    } finally { clearTimeout(deadline); abort.abort(); }
    assert.deepEqual(seen, ['/api/check', '/api/events'].map(path => ({ url: path, authorization: 'Bearer synthetic-owner', origin: url })));
    const dev = await (await fetch(`${url}/@vite/client`)).text(); assert.ok(!dev.includes('WebSocket'));
    await assert.rejects(startStaticWeb({ directory, repository, webPort, centerPort, artifact }), /already in use/);
  } finally { await staticWeb?.close(); await close(center); await rm(parent, { recursive: true, force: true }); }
});
