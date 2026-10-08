import { lstat, open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { z } from 'zod';
import { readTextFile } from './resources.js';

const identitySchema = z.strictObject({ protocol: z.literal('flow.engineering-owned-directory.v1'), device: z.number().int().nonnegative(), inode: z.number().int().nonnegative() });
/** Host-private identity records constrain cooperative recovery; they are not same-UID isolation. */
export async function directoryIdentity(directory: string) {
  const path = resolve(directory), info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path || (info.mode & 0o022) !== 0) throw new Error('Engineering storage must be an owned canonical directory.');
  return { protocol: 'flow.engineering-owned-directory.v1' as const, device: info.dev, inode: info.ino };
}
export async function writeRecord(file: string, value: unknown): Promise<void> {
  const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync(); } finally { await handle.close(); }
}
export async function recordDirectory(directory: string, name: string, value: unknown): Promise<void> {
  await writeRecord(join(directory, name), { identity: await directoryIdentity(directory), value });
}
export async function readDirectoryRecord<T>(directory: string, name: string, schema: z.ZodType<T>): Promise<T> {
  const parsed = z.strictObject({ identity: identitySchema, value: schema }).parse(JSON.parse((await readTextFile(join(directory, name), 16_384)).content));
  if (JSON.stringify(parsed.identity) !== JSON.stringify(await directoryIdentity(directory))) throw new Error('Engineering storage identity changed.');
  return parsed.value;
}
