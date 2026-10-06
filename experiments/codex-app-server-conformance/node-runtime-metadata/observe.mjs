import { observeLoader } from '../node-loader-cause/observe.mjs';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export function observeRuntimeArtifact(artifact, close, roles) {
  const unknown = () => ({ ...observeRuntimeLoader(Buffer.alloc(0), roles, false), descriptorClosed: true, sourceConfirmed: false });
  const capture = close?.stderrCapture;
  if (!artifact?.close || !artifact.flush || !artifact.identity || artifact.bytes > 8192 || close?.child !== 'confirmed-exited'
    || !capture?.streamEnded || !capture.childCloseObserved || capture.incomplete || capture.truncated || capture.observerFailed
    || capture.observedBytes !== artifact.bytes || capture.writtenBytes !== artifact.bytes) return unknown();
  let fd, descriptorClosed = true, observation = unknown();
  try {
    fd = fs.openSync(artifact.file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    descriptorClosed = false;
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.ino !== artifact.identity.ino || stat.dev !== artifact.identity.dev || stat.size !== artifact.bytes) throw Error('Unconfirmed private observation');
    const bytes = fs.readFileSync(fd);
    if (bytes.length !== artifact.bytes || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw Error('Unconfirmed private observation');
    observation = { ...observeRuntimeLoader(bytes, roles, true), sourceConfirmed: true };
  } catch { observation = unknown(); }
  finally { if (fd !== undefined) { try { fs.closeSync(fd); descriptorClosed = true; } catch { /* Never close a potentially reused fd twice. */ } } }
  return { ...observation, descriptorClosed };
}

// Data-only, finite dyld grammar. Paths are matched to fixed public roles, never returned.
export function observeRuntimeLoader(bytes, roles, complete) {
  const base = observeLoader(bytes, roles, complete);
  const unknown = { ...base, errno: null, errnoState: 'unknown', reasonState: 'UNKNOWN', reasons: [] };
  if (!complete || !Buffer.isBuffer(bytes) || bytes.length > 8192) return unknown;
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return unknown; }
  if (text.includes('\0')) return unknown;
  const reasons = [], keys = new Set(), errnos = new Set(); let unrecognized = false;
  const add = (operation, category, token, errno = null) => {
    if (errno !== null && (!Number.isSafeInteger(errno) || errno < 1 || errno > 255)) { unrecognized = true; return; }
    if (errno !== null) errnos.add(errno); // Finite 1..255 evidence survives the eight-detail presentation cap.
    const match = roles.find(row => row.token === token && /^[a-z0-9-]{1,48}$/.test(row.role));
    const reason = { operation, category, errno, dependencyRole: match?.role ?? null };
    const key = JSON.stringify(reason);
    if (!keys.has(key)) {
      if (reasons.length >= 8) { unrecognized = true; return; }
      keys.add(key); reasons.push(reason);
    }
  };
  for (const line of text.split(/\r?\n/)) {
    const header = /^[ \t]{0,4}Reason: (.{1,4096})$/.exec(line);
    if (!header) continue;
    const reason = header[1]; let match;
    if (reason.startsWith('tried: ')) {
      const body = reason.slice(7);
      const entry = /'([^'\r\n]{1,2048})' \((no such file|not a file|blocked by sandbox|cannot override a protected system dylib|errno=([0-9]{1,3}))(?:, (?:not in dyld cache|no dyld cache))?\)(?:, (?:not in dyld cache|no dyld cache))?(?:, |$)/gy;
      let at = 0;
      while (at < body.length && (match = entry.exec(body))) {
        const category = ({ 'no such file': 'missing', 'not a file': 'not-file', 'blocked by sandbox': 'sandbox-stat',
          'cannot override a protected system dylib': 'protected-override' })[match[2]] ?? 'explicit-errno';
        add('search-stat', category, match[1], match[3] ? Number(match[3]) : null); at = entry.lastIndex;
      }
      if (at !== body.length) unrecognized = true;
    } else if ((match = /^file system sandbox blocked stat\("([^"\r\n]{1,2048})"\)$/.exec(reason))) add('stat', 'sandbox-stat', match[1]);
    else if ((match = /^stat\("([^"\r\n]{1,2048})"\) failed with errno=([0-9]{1,3})$/.exec(reason))) add('stat', 'explicit-errno', match[1], Number(match[2]));
    else if ((match = /^(file system sandbox|code signing) blocked mmap\(\) of '([^'\r\n]{1,2048})'$/.exec(reason))) add('mmap', match[1] === 'code signing' ? 'code-sign-mmap' : 'sandbox-mmap', match[2]);
    else if ((match = /^mmap\(addr=0x[0-9a-fA-F]{1,16}, size=0x[0-9a-fA-F]{1,16}\) failed with errno=([0-9]{1,3}) for ([^\r\n]{1,2048})$/.exec(reason))) add('mmap', 'explicit-errno', match[2], Number(match[1]));
    else if (reason === 'no such file') add('unknown', 'missing', null);
    else unrecognized = true;
  }
  return { ...base, errno: errnos.size === 1 ? [...errnos][0] : null,
    errnoState: errnos.size > 1 ? 'conflict' : errnos.size === 1 ? 'observed-text' : 'unknown',
    reasonState: unrecognized ? 'partial-unknown' : reasons.length ? 'recognized-text' : 'UNKNOWN', reasons };
}
