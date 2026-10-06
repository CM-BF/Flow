import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const parameters = { seed: 41721, timelineEntries: 32, payloadBytes: 8192, agents: 128, steps: 64, batchEvents: 1024 };
const root = new URL('./', import.meta.url);
function syntheticEntries() {
  let random = parameters.seed;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: parameters.timelineEntries }, (_, index) => {
    let content = '';
    for (let byte = 0; byte < parameters.payloadBytes; byte++) {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
      content += alphabet[(random >>> 0) % alphabet.length];
    }
    const tool = { id: `detail-${index}`, title: `工具结果 ${index + 1}`, content, digest: createHash('sha256').update(content).digest('hex') };
    return { id: `event-${index}`, text: `步骤 ${index + 1} 完成，结果可展开查看。`, tool };
  });
}
function packed(value) {
  const json = Buffer.from(JSON.stringify(value));
  return { body: gzipSync(json), uncompressedBytes: json.length };
}
export async function startToyServer(port = 0) {
  const entries = syntheticEntries();
  const full = packed({ entries });
  const folded = packed({ entries: entries.map(({ id, text, tool }) => ({ id, text, reference: { id: tool.id, title: tool.title } })) });
  const details = new Map(entries.map(entry => [entry.tool.id, packed(entry.tool)]));
  const staticFiles = new Map(await Promise.all(['index.html', 'app.js', 'style.css'].map(async name => [name, await readFile(new URL(name, root))])));
  const traffic = { requests: 0, encodedBodyBytes: 0, uncompressedBytes: 0 };
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (staticFiles.has(name)) {
      response.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html', 'Cache-Control': 'no-store' });
      response.end(staticFiles.get(name)); return;
    }
    const result = url.pathname === '/api/timeline' ? (url.searchParams.get('mode') === 'full' ? full : folded)
      : url.pathname.startsWith('/api/details/') ? details.get(url.pathname.split('/').at(-1)) : undefined;
    if (!result) { response.writeHead(404).end('Not found'); return; }
    traffic.requests++;
    traffic.encodedBodyBytes += result.body.length;
    traffic.uncompressedBytes += result.uncompressedBytes;
    if (traffic.uncompressedBytes > 64 * 1024 * 1024) { response.writeHead(507).end('Toy transfer budget exceeded'); return; }
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': result.body.length, 'Cache-Control': 'no-store', 'X-Uncompressed-Bytes': result.uncompressedBytes });
    response.end(result.body);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, traffic, parameters,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const toy = await startToyServer(Number(process.env.LAB_PORT ?? 4338));
  console.log(toy.url);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void toy.close(); });
}
