import { createRequire } from 'node:module';
import { join, extname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { verifyWebArtifact } from './web-artifact.mjs';
import { readWebRelease, loadReleaseAssets, releaseAsset } from './web-release.mjs';
import { validateBrowserCompatibilityContext } from './browser-session-configuration.mjs';
function fail(code) { const error = new Error(code); error.code = code; throw error; }
export function createWebReleaseSnapshot(directory, { read = readWebRelease, expectedContext = null, expectedBackendHead = null } = {}) {
  if (expectedContext !== null) expectedContext = validateBrowserCompatibilityContext(expectedContext);
  let hasRelease = false;
  let cached; let cachedBytes; let loading = Promise.resolve();
  return async function snapshot() {
    loading = loading.catch(() => {}).then(async () => {
      const release = await read(directory);
      if (!release) { if (hasRelease || expectedContext !== null) fail('WEB_RELEASE_METADATA_MISSING'); return null; }
      hasRelease = true;
      const bytes = JSON.stringify(release);
      if (cached && (release.version < cached.version || release.version === cached.version && bytes !== cachedBytes)) fail('WEB_RELEASE_VERSION_CONFLICT');
      if (bytes !== cachedBytes) { const verified = await loadReleaseAssets({ directory, release, expectedContext, expectedBackendHead }); cached = verified; cachedBytes = bytes; }
      return cached;
    });
    return loading;
  };
}
export async function startStaticWeb({ directory, artifact, repository, webPort, centerPort, expectedContext = null, expectedBackendHead = null }) {
  for (const port of [webPort, centerPort]) if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail('INVALID_PORT');
  const { dist } = await verifyWebArtifact({ directory, artifact });
  let assetResponses = 0;
  const assetWaiters = [];
  function acquireAssetResponse(response) {
    return new Promise(resolve => {
      const grant = () => {
        assetResponses++; let released = false; let workDone = false; let responseEnded = false;
        const release = () => {
          if (released || !workDone || !responseEnded) return; released = true; assetResponses--;
          assetWaiters.shift()?.grant();
        };
        const ended = () => { responseEnded = true; release(); };
        response.once('finish', ended); response.once('close', ended);
        resolve(() => { workDone = true; release(); });
      };
      if (response.destroyed) return resolve(false);
      if (assetResponses < 4 && assetWaiters.length === 0) { grant(); return; }
      if (assetWaiters.length >= 32) return resolve(false);
      let timer;
      const remove = () => { clearTimeout(timer); response.off('close', cancel); const index = assetWaiters.indexOf(waiter); if (index >= 0) assetWaiters.splice(index, 1); };
      const cancel = () => { remove(); resolve(false); };
      const waiter = { grant: () => { remove(); grant(); } };
      assetWaiters.push(waiter); response.once('close', cancel);
      timer = setTimeout(cancel, 5000); timer.unref();
    });
  }
  const snapshot = createWebReleaseSnapshot(directory, { expectedContext, expectedBackendHead });
  await snapshot();
  const require = createRequire(join(repository, 'apps/web/package.json'));
  const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
  const server = await preview({ root: dist, configFile: false, envDir: false, publicDir: false, logLevel: 'silent',
    build: { outDir: dist },
    plugins: [{ name: 'flow-static-identity', configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0] ?? '/';
        if (/^\/api(?:\/|$)/.test(path)) return next();
        void (async () => {
          if (request.method !== 'GET' && request.method !== 'HEAD') { response.statusCode = 405; response.end(); return; }
          const finishWork = await acquireAssetResponse(response);
          if (!finishWork) { if (!response.destroyed) { response.statusCode = 503; response.end('Web asset readers busy'); } return; }
          try {
            const active = await snapshot();
            if (response.destroyed) return;
            response.setHeader('cache-control', 'no-store');
            if (path === '/__flow_preview_identity') {
              response.setHeader('content-type', 'application/json');
              response.end(JSON.stringify(active ? { ...active.artifact, releaseVersion: active.version, releasePolicy: 'flow-web-release-v1',
                runtimeCompatibility: { backendHead: active.verifiedTuple.backendHead, context: active.verifiedTuple.context } } : artifact)); return;
            }
            if (!active) { next(); return; }
            const asset = await releaseAsset(active, path, request.headers.accept?.includes('text/html'));
            if (!asset) { response.statusCode = 404; response.end(); return; }
            const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
            response.setHeader('content-type', types[extname(asset.path)] ?? 'application/octet-stream');
            response.setHeader('content-length', asset.bytes.length); response.setHeader('x-content-type-options', 'nosniff');
            response.end(request.method === 'HEAD' ? undefined : asset.bytes);
          } finally { finishWork(); }
        })().catch(() => { response.statusCode = 503; response.end('Web release unavailable'); });
      });
    } }],
    preview: { host: '127.0.0.1', port: webPort, strictPort: true, open: false, cors: false,
      headers: { 'Cache-Control': 'no-store' },
      proxy: { '^/api(?:/|$)': { target: `http://127.0.0.1:${centerPort}`, changeOrigin: false, ws: false,
        configure(proxy) {
          proxy.on('proxyRes', (upstream, _request, downstream) => {
            // A truncated upstream body must not leave its downstream response open
            // or be represented as a successful, complete HTTP body.
            upstream.once('aborted', () => downstream.destroy());
            upstream.once('error', () => downstream.destroy());
          });
        },
      } } },
  });
  server.httpServer.maxConnections = 64;
  return { artifact, close: async () => {
    server.httpServer.closeAllConnections();
    await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [directory, repository, webPort, centerPort, artifactId, sourceHead, manifestDigest] = process.argv.slice(2);
    const expectedContext = process.env.FLOW_PREVIEW_WEB_COMPATIBILITY_CONTEXT === undefined ? null
      : validateBrowserCompatibilityContext(JSON.parse(process.env.FLOW_PREVIEW_WEB_COMPATIBILITY_CONTEXT));
    const server = await startStaticWeb({ directory, repository, expectedContext, expectedBackendHead: process.env.FLOW_PREVIEW_WEB_BACKEND_HEAD ?? null, webPort: Number(webPort), centerPort: Number(centerPort), artifact: { artifactId, sourceHead, manifestDigest } });
    let closing = false;
    const stop = async () => { if (closing) return; closing = true; try { await server.close(); } catch { process.exitCode = 1; } };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
  } catch { process.stderr.write('STATIC_WEB_START_UNCONFIRMED\n'); process.exitCode = 1; }
}
