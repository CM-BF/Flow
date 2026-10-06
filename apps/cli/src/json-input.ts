import { open } from 'node:fs/promises';

export class JsonInputError extends Error {}

/** Read at most the caller's encoded JSON budget, even if a file grows during the read. */
export async function readJsonInput(path: string, maxBytes: number): Promise<unknown> {
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new JsonInputError('--input must be a regular JSON file.');
    const tooLarge = () => new JsonInputError(`JSON input must not exceed ${maxBytes} bytes.`);
    if (stat.size > maxBytes) throw tooLarge();
    const chunks: Buffer[] = [];
    let size = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(65_536, maxBytes - size + 1));
      const { bytesRead } = await file.read(chunk);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > maxBytes) throw tooLarge();
      chunks.push(chunk.subarray(0, bytesRead));
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); }
    catch { throw new JsonInputError('--input must contain valid UTF-8 JSON.'); }
  } finally { await file.close(); }
}
