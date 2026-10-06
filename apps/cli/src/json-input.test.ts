import * as fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { readJsonInput } from './json-input.js';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: vi.fn(actual.open) };
});
const execute = promisify(execFile);
const handles: FileHandle[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(handles.splice(0).map(handle => handle.close()));
});

it('rejects a real FIFO without waiting for a writer and closes the descriptor', async () => {
  const temporary = await fs.mkdtemp(path.join(tmpdir(), 'flow-json-fifo-'));
  const fifo = path.join(temporary, 'input.fifo');
  try {
    await execute('mkfifo', [fifo]);
    const script = `import { readJsonInput } from ${JSON.stringify(new URL('./json-input.ts', import.meta.url).href)};
      try { await readJsonInput(process.argv[1], 128); process.exitCode=1; }
      catch(error) { console.log(error.message); }`;
    const result = await execute(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, fifo], { timeout: 2000 });
    expect(result.stdout.trim()).toBe('--input must be a regular JSON file.');
    expect(result.stderr).toBe('');
    // Repeat in this process to verify that finally closes the handle opened for the FIFO.
    const handle = await fs.open(fifo, (await import('node:fs')).constants.O_RDONLY | (await import('node:fs')).constants.O_NONBLOCK);
    handles.push(handle);
    vi.mocked(fs.open).mockResolvedValueOnce(handle);
    await expect(readJsonInput(fifo, 128)).rejects.toThrow('regular JSON file');
    await expect(handle.stat()).rejects.toMatchObject({ code: 'EBADF' });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}, 4000);

it('decodes repeated short UTF-8 reads using one budget-sized buffer and closes on overflow', async () => {
  const temporary = await fs.mkdtemp(path.join(tmpdir(), 'flow-json-short-'));
  const filename = path.join(temporary, 'input.json');
  const value = { text: '中文🙂é\\\r\n'.repeat(40) };
  const raw = Buffer.from(JSON.stringify(value));
  try {
    await fs.writeFile(filename, raw);
    const handle = await fs.open(filename, 'r');
    handles.push(handle);
    vi.mocked(fs.open).mockResolvedValueOnce(handle);
    const read = handle.read.bind(handle);
    const buffers = new Set<ArrayBufferLike>();
    const lengths: number[] = [];
    vi.spyOn(handle, 'read').mockImplementation((async (options: { buffer: Buffer; offset: number; length: number }) => {
      buffers.add(options.buffer.buffer); lengths.push(options.buffer.byteLength);
      return read({ ...options, length: Math.min(options.length, 3) });
    }) as typeof handle.read);
    expect(await readJsonInput(filename, raw.length)).toEqual(value);
    expect(buffers.size).toBe(1);
    expect(new Set(lengths)).toEqual(new Set([raw.length + 1]));
    expect(lengths.length).toBeGreaterThan(100);
    await expect(handle.stat()).rejects.toMatchObject({ code: 'EBADF' });

    const growing = await fs.open(filename, 'r');
    handles.push(growing);
    vi.mocked(fs.open).mockResolvedValueOnce(growing);
    const stat = await growing.stat();
    vi.spyOn(growing, 'stat').mockResolvedValue({ ...stat, size: 0, isFile: () => true } as typeof stat);
    await expect(readJsonInput(filename, raw.length - 1)).rejects.toThrow('exceed');
    vi.restoreAllMocks();
    await expect(growing.stat()).rejects.toMatchObject({ code: 'EBADF' });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
});
