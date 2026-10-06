import { posix } from 'node:path';
import { digest, fail, LIMITS } from './files.mjs';
import { RUNTIME_CLOSURE_POLICY } from './dependency-plan.mjs';
function integrityHex(value) {
  if (typeof value !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(value)) fail('BACKEND_CACHE_INDEX_INVALID');
  const bytes = Buffer.from(value.slice(7), 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== value.slice(7)) fail('BACKEND_CACHE_INDEX_INVALID');
  return bytes.toString('hex');
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('BACKEND_CACHE_INDEX_INVALID');
  return value;
}
function filePath(value) {
  if (!value || value.length > 1024 || /[\\\x00-\x1f]/.test(value) || value.startsWith('/') || value === '..' || value.startsWith('../') || posix.normalize(value) !== value) fail('BACKEND_CACHE_INDEX_INVALID');
}

/** Pure CAFS identities, not a content-presence or physical-space proof. Copy/install remain later gates. */
export function runtimeCachePlan(plan, indexes) {
  if (plan?.policy !== RUNTIME_CLOSURE_POLICY || !Array.isArray(plan.packages) || plan.packages.length > 4096) fail('BACKEND_CACHE_INDEX_INVALID');
  object(indexes);
  const files = new Map(); let logicalBytes = 0, indexBytes = 0;
  function add(value) {
    const previous = files.get(value.path);
    if (previous) { if (JSON.stringify(previous) !== JSON.stringify(value)) fail('BACKEND_CACHE_CONTENT_CONFLICT'); return; }
    logicalBytes += value.bytes;
    if (files.size >= LIMITS.seedEntries || logicalBytes > LIMITS.seedBytes) fail('BACKEND_CACHE_BUDGET');
    files.set(value.path, value);
  }
  for (const pkg of plan.packages) {
    const hex = integrityHex(pkg.integrity), expectedPath = `files/${hex.slice(0, 2)}/${hex.slice(2)}-index.json`;
    if (pkg.cacheIndex !== expectedPath) fail('BACKEND_CACHE_INDEX_IDENTITY');
    if (!Object.hasOwn(indexes, expectedPath)) fail('BACKEND_CACHE_INDEX_MISSING');
    const raw = indexes[expectedPath];
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2 * 1024 ** 2) fail('BACKEND_CACHE_INDEX_INVALID');
    indexBytes += Buffer.byteLength(raw);
    if (indexBytes > 32 * 1024 ** 2) fail('BACKEND_CACHE_BUDGET');
    let index;
    try { index = object(JSON.parse(raw)); } catch { fail('BACKEND_CACHE_INDEX_INVALID'); }
    if (typeof index.name !== 'string' || typeof index.version !== 'string' || `${index.name}@${index.version}` !== pkg.key) fail('BACKEND_CACHE_INDEX_IDENTITY');
    const entries = Object.entries(object(index.files));
    if (entries.length > LIMITS.seedEntries) fail('BACKEND_CACHE_BUDGET');
    add({ path: expectedPath, kind: 'index', bytes: Buffer.byteLength(raw), sha256: digest(raw) });
    for (const [name, entry] of entries) {
      filePath(name); object(entry);
      if (!Number.isSafeInteger(entry.size) || entry.size < 0 || !Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o7777) fail('BACKEND_CACHE_INDEX_INVALID');
      const content = integrityHex(entry.integrity), executable = Boolean(entry.mode & 0o111);
      add({ path: `files/${content.slice(0, 2)}/${content.slice(2)}${executable ? '-exec' : ''}`, kind: 'content', bytes: entry.size, integrity: entry.integrity, executable });
    }
  }
  return { files: [...files.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), logicalBytes, contentPresenceVerified: false, physicalPeakMeasured: false };
}
