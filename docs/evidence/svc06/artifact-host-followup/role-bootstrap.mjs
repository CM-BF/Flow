// This bootstrap remains trusted/outside the profile. Actual runService and its state/nonce checks are unchanged.
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installServiceBoundary } from './service-boundary.mjs';
const [inputPath, role, nonceArg, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0); assert.ok(/^--flow-preview=[a-f0-9-]{36}$/.test(nonceArg ?? ''));
const info = await lstat(inputPath); assert.ok(info.isFile() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o600 && info.size <= 16384);
const input = JSON.parse(await readFile(inputPath, 'utf8'));
assert.ok(Object.hasOwn(input.roles, role));
const selected = input.roles[role];
for (const binding of input.runtime) {
  const bytes = await readFile(join(input.artifactRoot, binding.path));
  assert.equal(bytes.length, binding.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), binding.sha256);
}
assert.equal(selected.program, process.execPath);
installServiceBoundary({ profile: input.profile, expected: selected, logDirectory: join(dirname(inputPath), `diagnostic-${role}`) });
const cli = join(input.artifactRoot, 'tools/personal-preview/cli.mjs');
process.argv = [process.execPath, cli, 'internal-service', input.directory, role, nonceArg];
await import(pathToFileURL(cli).href);
