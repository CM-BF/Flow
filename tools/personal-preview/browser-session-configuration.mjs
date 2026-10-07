import { constants } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const maximumBytes = 4096;
const launchKey = 'FLOW_PREVIEW_BROWSER_POLICY_IDENTITY';
const pinned = new WeakMap();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(code = 'BROWSER_CONFIGURATION_INVALID') { const error = new Error(code); error.code = code; throw error; }
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function publicOrigin(value) {
  if (typeof value !== 'string' || value.length > 256) fail();
  let url; try { url = new URL(value); } catch { fail(); }
  if (url.origin !== value || url.username || url.password
    || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) fail();
  return url.origin;
}
/** Matches the existing center's explicit browser settings, without accepting credentials. */
export function normalizeBrowserSessionSettings(value) {
  if (!exactKeys(value, ['cookieOrigin', 'trustedOrigins', 'authEpoch']) || !Array.isArray(value.trustedOrigins)
    || value.trustedOrigins.length < 1 || value.trustedOrigins.length > 16
    || typeof value.authEpoch !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(value.authEpoch)) fail();
  const trustedOrigins = value.trustedOrigins.map(publicOrigin).sort();
  if (new Set(trustedOrigins).size !== trustedOrigins.length) fail();
  return Object.freeze({ cookieOrigin: publicOrigin(value.cookieOrigin), trustedOrigins: Object.freeze(trustedOrigins), authEpoch: value.authEpoch });
}
export function browserCompatibilityContext(settings) {
  if (settings === null) return null;
  const normalized = normalizeBrowserSessionSettings(settings);
  return Object.freeze({ format: 1, publicOrigin: normalized.cookieOrigin,
    policySha256: sha(JSON.stringify(['flow.browser-policy.v1', normalized])) });
}
export function validateBrowserCompatibilityContext(value) {
  if (!exactKeys(value, ['format', 'publicOrigin', 'policySha256']) || value.format !== 1
    || !/^[a-f0-9]{64}$/.test(value.policySha256 ?? '')) fail('WEB_COMPATIBILITY_CONTEXT_INVALID');
  try { publicOrigin(value.publicOrigin); } catch { fail('WEB_COMPATIBILITY_CONTEXT_INVALID'); }
  return Object.freeze({ format: 1, publicOrigin: value.publicOrigin, policySha256: value.policySha256 });
}
export function sameBrowserCompatibilityContext(left, right) {
  if (left === null || right === null) return left === right;
  return JSON.stringify(validateBrowserCompatibilityContext(left)) === JSON.stringify(validateBrowserCompatibilityContext(right));
}
function identity(info) {
  return { dev: String(info.dev), ino: String(info.ino), uid: String(info.uid), mode: String(info.mode),
    nlink: String(info.nlink), bytes: String(info.size), modifiedNs: String(info.mtimeNs), changedNs: String(info.ctimeNs) };
}
function privateFile(info) {
  if (!info.isFile() || info.uid !== BigInt(process.getuid()) || (info.mode & 0o777n) !== 0o600n
    || info.nlink !== 1n || info.size > BigInt(maximumBytes)) fail();
}
async function unchangedPrivateRoot(directory, before) {
  const after = await lstat(directory, { bigint: true });
  if (!after.isDirectory() || after.isSymbolicLink() || after.uid !== BigInt(process.getuid()) || (after.mode & 0o777n) !== 0o700n
    || after.dev !== before.dev || after.ino !== before.ino || await realpath(directory) !== directory) fail('BROWSER_CONFIGURATION_CHANGED');
}
/** A missing file is explicit legacy mode; malformed/pending files never become legacy. */
export async function readBrowserSessionConfiguration(config) {
  const directory = resolve(config.directory); const root = await lstat(directory, { bigint: true });
  if (!root.isDirectory() || root.isSymbolicLink() || root.uid !== BigInt(process.getuid())
    || (root.mode & 0o777n) !== 0o700n || await realpath(directory) !== directory) fail();
  const path = join(directory, 'browser-session.json'); let before;
  try { before = await lstat(path, { bigint: true }); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await unchangedPrivateRoot(directory, root);
    return Object.freeze({ settings: null, context: null, pin: Object.freeze({ directory, rootDev: String(root.dev), rootIno: String(root.ino), file: null }) });
  }
  privateFile(before);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes;
  try {
    const opened = await file.stat({ bigint: true }); privateFile(opened);
    if (JSON.stringify(identity(opened)) !== JSON.stringify(identity(before))) fail('BROWSER_CONFIGURATION_CHANGED');
    const buffer = Buffer.alloc(maximumBytes + 1); let offset = 0;
    while (offset < buffer.length) { const read = await file.read(buffer, offset, buffer.length - offset, offset); if (!read.bytesRead) break; offset += read.bytesRead; }
    if (offset > maximumBytes || BigInt(offset) !== opened.size) fail();
    bytes = buffer.subarray(0, offset);
    if (JSON.stringify(identity(await file.stat({ bigint: true }))) !== JSON.stringify(identity(opened))) fail('BROWSER_CONFIGURATION_CHANGED');
  } finally { await file.close(); }
  const after = await lstat(path, { bigint: true }); privateFile(after);
  await unchangedPrivateRoot(directory, root);
  if (JSON.stringify(identity(after)) !== JSON.stringify(identity(before)) || await realpath(path) !== path) fail('BROWSER_CONFIGURATION_CHANGED');
  let value; try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(); }
  if (!exactKeys(value, ['format', 'installationId', 'browserSession']) || value.format !== 1
    || value.installationId !== config.installationId || !/^[a-f0-9-]{36}$/.test(value.installationId ?? '')) fail();
  const settings = normalizeBrowserSessionSettings(value.browserSession);
  return Object.freeze({ settings, context: browserCompatibilityContext(settings), pin: Object.freeze({ directory, rootDev: String(root.dev), rootIno: String(root.ino),
    file: Object.freeze({ ...identity(after), sha256: sha(bytes) }) }) });
}
/** Reused config objects retain the first verified identity across preflight and stop/start. */
export async function pinnedBrowserSessionConfiguration(config) {
  const current = await readBrowserSessionConfiguration(config); const previous = pinned.get(config);
  if (previous && JSON.stringify(previous.pin) !== JSON.stringify(current.pin)) fail('BROWSER_CONFIGURATION_CHANGED');
  pinned.set(config, current); return current;
}
export function browserSessionLaunchEnvironment(configuration) {
  return { [launchKey]: JSON.stringify(configuration.pin) };
}
/** Only an owned wrapper may select the file it was preflighted with; inherited settings are ignored. */
export async function readBrowserSessionLaunch(config, inherited = process.env) {
  const current = await pinnedBrowserSessionConfiguration(config); const declared = inherited[launchKey];
  if (declared === undefined && current.settings === null) return current; // Existing unconfigured launchers remain legacy.
  if (declared !== JSON.stringify(current.pin)) fail('BROWSER_CONFIGURATION_CHANGED');
  return current;
}
