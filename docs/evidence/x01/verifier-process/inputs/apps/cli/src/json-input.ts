import { open } from 'node:fs/promises';
import { constants } from 'node:fs';

export class JsonInputError extends Error {}

/** Read at most the caller's encoded JSON budget, even if a file grows during the read. */
export async function readJsonInput(path: string, maxBytes: number): Promise<unknown> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new JsonInputError('--input must be a regular JSON file.');
    const tooLarge = () => new JsonInputError(`JSON input must not exceed ${maxBytes} bytes.`);
    if (stat.size > maxBytes) throw tooLarge();
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (true) {
      const { bytesRead } = await file.read({ buffer, offset: size, length: Math.min(65_536, buffer.length - size) });
      if (!bytesRead) break;
      size += bytesRead;
      if (size > maxBytes) throw tooLarge();
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size))); }
    catch { throw new JsonInputError('--input must contain valid UTF-8 JSON.'); }
  } finally { await file.close(); }
}
