import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { z } from 'zod';
import { createCodexTransport } from '../../codex/index.js';
import { codexExecutionProfileConfigurationSchema } from '../../../../../packages/contracts/src/execution-profiles.js';
import { configureCodexHarness, type CodexTransportFactory } from './index.js';
import { createCodexSessionStorage, type PersistentCodexTransportFactory } from './session-storage.js';
import { guardExecutionProfile, publishNativeExecutionProfile } from '../../execution-profiles.js';

/** JSON supplies only the public profile. Launch authority is an explicit trusted code dependency.
 * Production uses a separately selected operator recipe; this legacy seam has no default factory. */
export function configureCodexLaunch(configuration: unknown, createTransport?: CodexTransportFactory) {
  const publicProfile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (!createTransport) throw new Error('A trusted Codex launch factory is unavailable.');
  return configureCodexHarness({ publicProfile, createTransport });
}

/** The operator owns this directory and factory; neither comes from task/profile JSON.
 * Publication must confirm the runner and configuration before storage can be bound.
 * Construction never launches a native process; the host retains directory ownership. */
export async function publishPersistentCodexLaunch(configuration: unknown, options: {
  baseUrl: string; token: string; signal?: AbortSignal;
  codeHome: string; createTransport: PersistentCodexTransportFactory;
}) {
  const { baseUrl, token, signal, codeHome, createTransport } = options;
  const publicProfile = codexExecutionProfileConfigurationSchema.parse(configuration);
  if (publicProfile.sessionPersistence !== 'host-owned') throw new Error('A persistent Codex profile is required.');
  if (typeof createTransport !== 'function') throw new Error('A trusted Codex launch factory is unavailable.');
  const reference = await publishNativeExecutionProfile({ baseUrl, token, signal, configuration: publicProfile });
  signal?.throwIfAborted();
  const sessionStorage = createCodexSessionStorage({ codeHome, runnerId: reference.runnerId,
    configDigest: reference.configDigest, createTransport });
  const configured = configureCodexHarness({ publicProfile, sessionStorage });
  return { reference: Object.freeze(reference), configured: { ...configured,
    adapter: guardExecutionProfile(configured.adapter, reference, publicProfile) } };
}

const operatorPath = z.string().min(1).max(4096).refine(value => isAbsolute(value) && normalize(value) === value && !/[\x00-\x1f]/.test(value));
const launchRecipeSchema = z.strictObject({
  protocol: z.literal('flow.codex-launch.v1'), executable: operatorPath, executableSha256: z.string().regex(/^[a-f0-9]{64}$/),
  home: operatorPath, codeHome: operatorPath, temporaryDirectory: operatorPath,
});
const unavailable = () => new Error('The selected Codex host recipe is unavailable.');

/** Operator configuration only. It cannot be supplied by a task or public profile.
 * Existing private roots remain host-owned across native processes and runner restarts.
 * File identity checks detect replacement; they are not an OS isolation or authentication proof. */
export function prepareCodexLaunchRecipe(input: unknown): { codeHome: string; createTransport: PersistentCodexTransportFactory } {
  const recipe = launchRecipeSchema.parse(input);
  const directories = [recipe.home, recipe.codeHome, recipe.temporaryDirectory].map(path => ({ path, identity: privateDirectory(path) }));
  const executable = executableIdentity(recipe.executable);
  const fd = openSync(recipe.executable, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (fileIdentity(fstatSync(fd)) !== executable) throw unavailable();
    const hash = createHash('sha256'); const buffer = Buffer.alloc(65_536); let offset = 0;
    while (offset <= 512 * 1024 * 1024) {
      const bytes = readSync(fd, buffer, 0, buffer.length, offset);
      if (!bytes) break;
      offset += bytes; if (offset > 512 * 1024 * 1024) throw unavailable();
      hash.update(buffer.subarray(0, bytes));
    }
    if (fileIdentity(fstatSync(fd)) !== executable || hash.digest('hex') !== recipe.executableSha256) throw unavailable();
  } finally { closeSync(fd); }
  return { codeHome: recipe.codeHome, createTransport(options) {
    options.signal.throwIfAborted();
    if (options.codeHome !== recipe.codeHome || executableIdentity(recipe.executable) !== executable
      || directories.some(({ path, identity }) => privateDirectory(path) !== identity)) throw unavailable();
    return createCodexTransport({
      spawn: { executable: recipe.executable, args: ['app-server', '--listen', 'stdio://'], cwd: options.workingDirectory,
        environment: { PATH: '/usr/bin:/bin', HOME: recipe.home, CODEX_HOME: options.codeHome, TMPDIR: recipe.temporaryDirectory,
          LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC' } },
      initialize: { clientInfo: { name: 'flow-runner', title: null, version: '0.1.0' }, capabilities: null }, signal: options.signal,
    });
  } };
}
function privateDirectory(path: string): string {
  const value = lstatSync(path);
  if (!value.isDirectory() || value.isSymbolicLink() || realpathSync(path) !== path
    || value.uid !== process.getuid?.() || (value.mode & 0o077) !== 0) throw unavailable();
  return `${value.dev}:${value.ino}`;
}
function fileIdentity(value: NonNullable<ReturnType<typeof lstatSync>>): string {
  return `${value.dev}:${value.ino}:${value.size}:${value.mtimeMs}:${value.ctimeMs}`;
}
function executableIdentity(path: string): string {
  const value = lstatSync(path);
  if (!value.isFile() || value.isSymbolicLink() || realpathSync(path) !== path || value.size > 512 * 1024 * 1024
    || (value.mode & 0o111) === 0 || (value.mode & 0o022) !== 0) throw unavailable();
  return fileIdentity(value);
}
