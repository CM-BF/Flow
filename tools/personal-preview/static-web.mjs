import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { verifyWebArtifact } from './web-artifact.mjs';
function fail(code) { const error = new Error(code); error.code = code; throw error; }
export async function startStaticWeb({ directory, artifact, repository, webPort, centerPort }) {
  for (const port of [webPort, centerPort]) if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail('INVALID_PORT');
  const { dist } = await verifyWebArtifact({ directory, artifact });
  const require = createRequire(join(repository, 'apps/web/package.json'));
  const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
  const server = await preview({ root: dist, configFile: false, envDir: false, publicDir: false, logLevel: 'silent',
    build: { outDir: dist },
    plugins: [{ name: 'flow-static-identity', configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/__flow_preview_identity') return next();
        if (request.method !== 'GET' && request.method !== 'HEAD') { response.statusCode = 405; response.end(); return; }
        response.setHeader('content-type', 'application/json'); response.setHeader('cache-control', 'no-store');
        response.end(JSON.stringify(artifact));
      });
    } }],
    preview: { host: '127.0.0.1', port: webPort, strictPort: true, open: false, cors: false,
      headers: { 'Cache-Control': 'no-store' },
      proxy: { '^/api(?:/|$)': { target: `http://127.0.0.1:${centerPort}`, changeOrigin: false, ws: false } } },
  });
  return { artifact, close: async () => {
    server.httpServer.closeAllConnections();
    await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [directory, repository, webPort, centerPort, artifactId, sourceHead, manifestDigest] = process.argv.slice(2);
    const server = await startStaticWeb({ directory, repository, webPort: Number(webPort), centerPort: Number(centerPort), artifact: { artifactId, sourceHead, manifestDigest } });
    let closing = false;
    const stop = async () => { if (closing) return; closing = true; try { await server.close(); } catch { process.exitCode = 1; } };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
  } catch { process.stderr.write('STATIC_WEB_START_UNCONFIRMED\n'); process.exitCode = 1; }
}
