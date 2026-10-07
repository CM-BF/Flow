/** Evidence-only preparation: no subprocess, model, database or transport. */
import { constants, closeSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { prepareDarwinStockHelper } from '../../../../apps/runner/src/engineering/native-authority.js';

const scratch = process.argv[2];
if (!scratch || realpathSync(scratch) !== scratch || !scratch.startsWith('/private/tmp/eng01j-stock-host-')) throw Error('SCRATCH_INVALID');
const root = lstatSync(scratch);
if (!root.isDirectory() || root.uid !== process.getuid?.() || (root.mode & 0o077)) throw Error('SCRATCH_OWNER_INVALID');
const directory = join(scratch, 'workspace'), runtimeDirectory = join(scratch, 'runtime'), control = join(runtimeDirectory, 'control');
const startupRecipe = readFileSync(new URL('./startup-input.sb', import.meta.url), 'utf8');
const host = await prepareDarwinStockHelper({ directory, runtimeDirectory, startupRecipe, contents: Buffer.from('X') });
const launch = host.takeLaunch(new AbortController().signal);
const policy = launch.args[1];
if (!policy || launch.args.length !== 4 || launch.args[0] !== '-p' || launch.args[3] !== '--codex-run-as-fs-helper'
  || launch.stdin !== 'readonly-regular-file' || launch.extraDescriptors !== 'closed' || Buffer.byteLength(launch.requestLine) > 1024) throw Error('LAUNCH_SHAPE_INVALID');
function save(path: string, bytes: string, mode: number) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
save(join(control, 'policy.sb'), policy, 0o400);
save(join(control, 'request.json'), launch.requestLine, 0o400);
const metadata = { policySha256: host.policySha256, requestSha256: createHash('sha256').update(launch.requestLine).digest('hex'),
  executable: launch.executable, native: launch.args[2], helperArgument: launch.args[3], cwd: launch.cwd,
  environment: launch.environment, stdin: launch.stdin, extraDescriptors: launch.extraDescriptors, writeAccess: 'unknown' };
save(join(control, 'launch.json'), JSON.stringify(metadata) + '\n', 0o400);
const fd = openSync(control, constants.O_RDONLY | constants.O_NOFOLLOW);
try { fsyncSync(fd); } finally { closeSync(fd); }
process.stdout.write(JSON.stringify({ prepared: true, policySha256: metadata.policySha256, requestSha256: metadata.requestSha256, stockStarts: 0 }) + '\n');
