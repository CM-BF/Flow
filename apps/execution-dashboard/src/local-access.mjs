import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

const MAX_CONFIG_BYTES = 64 * 1024;
const PRODUCT_URL = 'http://127.0.0.1:61228/';
const UNAVAILABLE = '本机连接凭据不可用；请由本机安装负责人核对配置与权限。';
const securityHeaders = {
  'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

function unavailable() { return new Error(UNAVAILABLE); }
function requireValue(condition) { if (!condition) throw unavailable(); }
function sameFile(left, right) { return left.dev === right.dev && left.ino === right.ino; }
function privateEntry(stat, directory) {
  return (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1)
    && stat.uid === process.geteuid() && (stat.mode & 0o7777) === (directory ? 0o700 : 0o600);
}
function metadata(enabled, productUrl = PRODUCT_URL) {
  return { enabled, productUrl, centerUrl: '', centerMode: 'web-proxy' };
}

// Startup consumes only an explicit, nonsecret binding. The config is read on demand.
export async function createLocalInstallationProvider(binding) {
  try {
    requireValue(binding && Object.keys(binding).sort().join(',') === 'directory,installationId,productOrigin,repository');
    requireValue(typeof binding.directory === 'string' && path.isAbsolute(binding.directory));
    requireValue(typeof binding.repository === 'string' && path.isAbsolute(binding.repository));
    requireValue(typeof binding.installationId === 'string' && /^[a-f0-9-]{36}$/.test(binding.installationId));
    const product = new URL(binding.productOrigin);
    requireValue(product.protocol === 'http:' && product.hostname === '127.0.0.1' && product.port
      && !product.username && !product.password && !product.search && !product.hash && product.pathname === '/');
    const directory = path.resolve(binding.directory);
    const repository = await realpath(binding.repository);
    requireValue(await realpath(directory) === directory);
    const directoryStat = await lstat(directory);
    requireValue(privateEntry(directoryStat, true));
    const expected = Object.freeze({ directory, repository, installationId: binding.installationId, webPort: Number(product.port) });
    const publicMetadata = Object.freeze(metadata(true, product.href));
    return Object.freeze({
      metadata: publicMetadata,
      async readOwnerToken() {
        try { return await readBoundToken(expected, directoryStat); }
        catch { throw unavailable(); }
      },
    });
  } catch { throw unavailable(); }
}

async function verifyDirectory(expected, original) {
  requireValue(await realpath(expected.directory) === expected.directory);
  const current = await lstat(expected.directory);
  requireValue(privateEntry(current, true) && sameFile(current, original));
}

async function readBoundToken(expected, directoryStat) {
  await verifyDirectory(expected, directoryStat);
  const file = await open(path.join(expected.directory, 'config.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    requireValue(privateEntry(before, false) && before.size > 0 && before.size <= MAX_CONFIG_BYTES);
    // A bounded descriptor read also caps a file that grows after fstat.
    const bytes = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await file.read(bytes, length, bytes.length - length, length);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    const after = await file.stat();
    requireValue(length === before.size && length <= MAX_CONFIG_BYTES && privateEntry(after, false)
      && sameFile(before, after) && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs);
    await verifyDirectory(expected, directoryStat);
    const config = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    requireValue(config?.format === 1 && config.directory === expected.directory && config.repository === expected.repository
      && config.installationId === expected.installationId && config.webPort === expected.webPort
      && Number.isInteger(config.centerPort) && config.centerPort > 0 && config.centerPort <= 65535);
    requireValue(typeof config.ownerToken === 'string' && /^[A-Za-z0-9_-]{32,512}$/.test(config.ownerToken));
    return config.ownerToken;
  } finally { await file.close(); }
}

export async function localInstallationFromOptions(args, env) {
  if (!args.includes('--local-installation')) return undefined;
  try {
    requireValue(typeof env.FLOW_DASHBOARD_LOCAL_INSTALLATION === 'string' && env.FLOW_DASHBOARD_LOCAL_INSTALLATION.length <= 16384);
    return await createLocalInstallationProvider(JSON.parse(env.FLOW_DASHBOARD_LOCAL_INSTALLATION));
  } catch { throw unavailable(); }
}

function isLoopback(address) { return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'; }
function sameDashboard(request) {
  const authority = `127.0.0.1:${request.socket.localPort}`;
  return isLoopback(request.socket.remoteAddress) && request.headers.host === authority;
}
function deliberateRead(request) {
  return sameDashboard(request) && request.headers.origin === `http://${request.headers.host}`
    && request.headers['sec-fetch-site'] === 'same-origin' && request.headers['sec-fetch-mode'] === 'cors'
    && request.headers['x-flow-local-access'] === '1'
    && !request.headers['transfer-encoding'] && (request.headers['content-length'] ?? '0') === '0';
}

// This private handler owns every error on its routes: provider exceptions never reach the dashboard's generic catch.
export function createLocalAccessHandler(provider) {
  let reading = false;
  return async function handleLocalAccess(request, response) {
    if (!request.url?.split('?')[0].startsWith('/api/local-access')) return false;
    const send = (status, payload) => {
      if (!response.destroyed) {
        response.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(payload));
      }
      return true;
    };
    try {
      if (!sameDashboard(request)) return send(403, { error: '请从本机看板的 127.0.0.1 地址访问。' });
      if (request.url === '/api/local-access' && request.method === 'GET') {
        // Projection deliberately omits all provider implementation/configuration fields.
        const value = provider?.metadata;
        return send(200, metadata(Boolean(value?.enabled), value?.enabled ? value.productUrl : PRODUCT_URL));
      }
      if (request.url !== '/api/local-access/owner-token') return send(404, { error: '连接接口不存在。' });
      if (request.method !== 'POST') return send(405, { error: '凭据只接受主动加载请求。' });
      if (!deliberateRead(request)) return send(403, { error: '凭据只允许从此看板主动加载。' });
      if (!provider?.metadata.enabled) return send(404, { error: '本机凭据读取未启用。' });
      if (reading) return send(409, { error: '已有加载请求，请稍后重试。' });
      reading = true;
      try {
        const ownerToken = await provider.readOwnerToken();
        requireValue(typeof ownerToken === 'string' && /^[A-Za-z0-9_-]{32,512}$/.test(ownerToken));
        return send(200, { ownerToken });
      } finally { reading = false; }
    } catch { return send(503, { error: UNAVAILABLE }); }
  };
}
