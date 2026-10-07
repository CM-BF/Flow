import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

const maximumBytes = 65_536;
/** Bounded host-local input. Callers own schema validation and safe domain error messages. */
export async function readPrivateJsonConfiguration(filename: string): Promise<unknown> {
  if (!isAbsolute(filename)) throw new Error('Invalid private configuration path.');
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || (process.getuid && stat.uid !== process.getuid()) || stat.size > maximumBytes) throw new Error('Invalid private configuration file.');
    const bytes = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maximumBytes) throw new Error('Private configuration exceeds its limit.');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))) as unknown;
  } finally { await file.close(); }
}
