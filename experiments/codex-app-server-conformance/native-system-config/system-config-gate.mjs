import fs from 'node:fs';

// BigInt preserves the system symlink inode, which exceeds Number.MAX_SAFE_INTEGER.
const parents = Object.freeze([
  { path: '/etc', dev: '16777234', ino: '1152921500312571429', kind: 'symlink', target: 'private/etc' },
  { path: '/private', dev: '16777234', ino: '113129833', kind: 'directory' },
  { path: '/private/etc', dev: '16777234', ino: '113129834', kind: 'directory' },
]);
const absentPaths = Object.freeze([
  '/etc/codex', '/private/etc/codex',
  '/etc/codex/requirements.toml', '/etc/codex/config.toml', '/etc/codex/managed_config.toml',
  '/private/etc/codex/requirements.toml', '/private/etc/codex/config.toml', '/private/etc/codex/managed_config.toml',
]);
const safeCode = error => ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error?.code) ? error.code : 'UNKNOWN';

// Two parent samples bracket exact absence checks. This is a fresh observation, not an immutable OS snapshot.
export function inspectSystemConfiguration(io = fs) {
  const result = { passed: false, state: 'UNKNOWN', method: 'lstat/readlink only', parentSamples: 0,
    absentCount: 0, obstruction: null, code: null, raceFree: false };
  const parentsMatch = () => {
    for (const expected of parents) {
      const stat = io.lstatSync(expected.path, { bigint: true });
      const kindMatches = expected.kind === 'symlink' ? stat.isSymbolicLink()
        && io.readlinkSync(expected.path) === expected.target : stat.isDirectory() && !stat.isSymbolicLink();
      if (!kindMatches || (stat.mode & 0o777n) !== 0o755n
        || stat.dev.toString() !== expected.dev || stat.ino.toString() !== expected.ino) {
        result.state = 'PARENT_CHANGED'; result.obstruction = expected.path; return false;
      }
    }
    result.parentSamples++; return true;
  };
  try {
    if (!parentsMatch()) return result;
    for (const file of absentPaths) {
      try { io.lstatSync(file, { bigint: true }); }
      catch (error) {
        if (error?.code === 'ENOENT') { result.absentCount++; continue; }
        result.obstruction = file; result.code = safeCode(error); return result;
      }
      result.state = 'PRESENT'; result.obstruction = file; return result;
    }
    if (!parentsMatch()) return result;
    result.passed = true; result.state = 'ABSENT'; return result;
  } catch (error) { result.code = safeCode(error); return result; }
}
