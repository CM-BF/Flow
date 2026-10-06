import fs from 'node:fs';
import { createHash } from 'node:crypto';

// The host retains this one diagnostic copy; target-root cleanup never owns it.
export function retainPrivateText(file, bytes, inputComplete, budget, io = fs) {
  const artifact = { file, owned: false, identity: null, bytes: 0, sha256: null, closed: true,
    flushed: false, identityConfirmed: false, inputComplete: inputComplete === true, complete: false, removed: false };
  let fd;
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length > 8192) throw Error('Invalid bounded diagnostic copy');
    budget.reserveDisk(bytes.length);
    fd = io.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    artifact.owned = true; artifact.closed = false; // Ownership starts before identity can fail.
    const stat = io.fstatSync(fd);
    artifact.identity = { dev: stat.dev, ino: stat.ino, regular: stat.isFile() };
    if (fd < 3 || !stat.isFile() || (stat.mode & 0o777) !== 0o600) throw Error('Unconfirmed diagnostic identity');
    while (artifact.bytes < bytes.length) {
      const n = io.writeSync(fd, bytes, artifact.bytes, bytes.length - artifact.bytes);
      if (!Number.isSafeInteger(n) || n < 1 || n > bytes.length - artifact.bytes) throw Error('Unconfirmed diagnostic write');
      artifact.bytes += n; budget.disk(n); // Successful partial writes count even if a later step fails.
    }
    io.fsyncSync(fd); artifact.flushed = true;
  } catch { /* Safe state is returned, never raw OS errors or a lost resource receipt. */ }
  finally {
    if (fd !== undefined) { try { io.closeSync(fd); artifact.closed = true; } catch { /* No second close of a possibly reused fd. */ } }
  }
  if (artifact.owned && Buffer.isBuffer(bytes)) artifact.sha256 = createHash('sha256').update(bytes.subarray(0, artifact.bytes)).digest('hex');
  if (artifact.owned && artifact.closed && artifact.identity) {
    try {
      const stat = io.lstatSync(file);
      artifact.identityConfirmed = stat.isFile() && !stat.isSymbolicLink() && stat.dev === artifact.identity.dev
        && stat.ino === artifact.identity.ino && stat.size === artifact.bytes && (stat.mode & 0o777) === 0o600;
    } catch { /* The known identity remains in the receipt. */ }
  }
  artifact.complete = artifact.inputComplete && artifact.owned && artifact.closed && artifact.flushed
    && artifact.identityConfirmed && artifact.bytes === bytes?.length;
  return artifact;
}

// Explicit post-diagnosis action only. Neither running the recipe nor importing this module calls it.
export function removePrivateText(artifact, io = fs) {
  if (!artifact?.owned || !artifact.closed || !artifact.identity) return { removed: false, reason: 'unconfirmed-identity-or-close' };
  try {
    const stat = io.lstatSync(artifact.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== artifact.identity.dev || stat.ino !== artifact.identity.ino
      || stat.size !== artifact.bytes || (stat.mode & 0o777) !== 0o600) return { removed: false, reason: 'identity-changed' };
    io.unlinkSync(artifact.file);
    try { io.lstatSync(artifact.file); return { removed: false, reason: 'path-still-present' }; }
    catch (error) { return { removed: error?.code === 'ENOENT', reason: error?.code === 'ENOENT' ? 'exact-owned-file-removed' : 'absence-unknown' }; }
  } catch { return { removed: false, reason: 'removal-unknown' }; }
}
