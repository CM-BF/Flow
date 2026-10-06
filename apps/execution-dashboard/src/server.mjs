import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { aggregate } from './aggregate.mjs';
import { loadRegistry } from './registry.mjs';
import { readDocument } from './documents.mjs';

const publicFiles = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]]);
const imageTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export function createDashboardServer(registry) {
  let pendingSnapshot;
  const snapshot = () => pendingSnapshot ??= aggregate(registry).finally(() => { pendingSnapshot = undefined; });
  return http.createServer(async (request, response) => {
    const send = (code, body, type = 'application/json; charset=utf-8') => {
      response.writeHead(code, { ...headers, 'Content-Type': type });
      response.end(body);
    };
    try {
      if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(request.headers.host ?? '')) return send(403, JSON.stringify({ error: '仅允许 loopback Host' }));
      if (request.method !== 'GET') return send(405, JSON.stringify({ error: '只读接口仅接受 GET' }));
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/api/snapshot') return send(200, JSON.stringify(await snapshot()));
      if (url.pathname === '/api/document') {
        const task = registry.tasks.find(item => item.id === url.searchParams.get('task'));
        if (!task) return send(404, JSON.stringify({ error: '任务未登记' }));
        const relative = url.searchParams.get('path') ?? '';
        try {
          const document = await readDocument(task, relative);
          return send(200, document.content, imageTypes[path.extname(relative)] ?? 'text/plain; charset=utf-8');
        } catch (error) { return send(404, JSON.stringify({ error: error.message })); }
      }
      const asset = publicFiles.get(url.pathname);
      if (!asset) return send(404, JSON.stringify({ error: '页面不存在' }));
      send(200, await readFile(new URL(`../public/${asset[0]}`, import.meta.url)), asset[1]);
    } catch (error) { send(500, JSON.stringify({ error: `读取失败：${error.message}` })); }
  });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('请使用 Node 24（项目基线 >=24.20.0 <25）');
  const args = process.argv.slice(2);
  const configIndex = args.indexOf('--config');
  if (configIndex >= 0 && !args[configIndex + 1]) throw new Error('--config 需要 JSON 路径');
  const registry = await loadRegistry(configIndex >= 0 ? args[configIndex + 1] : process.env.FLOW_DASHBOARD_CONFIG);
  if (args.includes('--json')) { process.stdout.write(`${JSON.stringify(await aggregate(registry), null, 2)}\n`); return; }
  const port = Number(process.env.PORT ?? 4320);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1–65535');
  const server = createDashboardServer(registry);
  server.listen(port, '127.0.0.1', () => console.log(`Flow 工程进度 http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
