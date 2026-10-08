import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, lstat, mkdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { userInfo } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { recordDigest } from './stage-policy.mjs';

const FIXED_RUNTIME = [
  {
    "path": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.290_@anthropic-ai+sdk@0.131.0_zod@4.6.5__@modelcontextprot_qzqoiskwjgbes3l4fvedsmb7w4/node_modules/@anthropic-ai/claude-agent-sdk/package.json",
    "bytes": 2546,
    "sha256": "ab573b2052ad648ff3871ad0ae792a8900df4caae716d4d9279895ddb04ceef3"
  },
  {
    "path": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.290_@anthropic-ai+sdk@0.131.0_zod@4.6.5__@modelcontextprot_qzqoiskwjgbes3l4fvedsmb7w4/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs",
    "bytes": 1230597,
    "sha256": "6a628372e492ad4e2bba08c95862055dd02aaa0786365426f166a60f19f540a2"
  },
  {
    "path": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-darwin-arm64@0.3.290/node_modules/@anthropic-ai/claude-agent-sdk-darwin-arm64/claude",
    "bytes": 233260816,
    "sha256": "b8412a3826b2dc8ecb1c0605970c28dea28355de5faa740407dd881acdd40237"
  }
];
const WRITE_POLICY = Object.freeze({ authentication: 'existing-default-keychain-normal-native-refresh',
  credentialCopy: false, accountChange: false, privateFiles: 'owned-home-config-tmp', persistSession: false,
  sharedKeychainMayUpdate: true, keychainIncludedInPrivateByteBudget: false, totalSystemZeroWrites: false });
const NORMAL_ACCOUNT_HOME = Object.freeze({ kind: 'normal-account', username: 'citrine', path: '/Users/citrine' });
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), expected.sort());
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
async function directory(path) {
  assert(isAbsolute(path) && await realpath(path) === path);
  const s = await lstat(path, { bigint: true });
  assert(s.isDirectory() && s.uid === BigInt(process.getuid()) && (s.mode & 0o777n) === 0o700n);
  return { path, dev: String(s.dev), ino: String(s.ino) };
}
async function fixedFile(expected) {
  assert.equal(await realpath(expected.path), expected.path);
  const h = await open(expected.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await h.stat({ bigint: true }); assert(before.isFile() && before.size === BigInt(expected.bytes));
    const hash = createHash('sha256'), chunk = Buffer.alloc(65536); let count = 0;
    for (;;) { const { bytesRead } = await h.read(chunk, 0, chunk.length, null); if (!bytesRead) break;
      count += bytesRead; assert(count <= expected.bytes); hash.update(chunk.subarray(0, bytesRead)); }
    const after = await h.stat({ bigint: true }), named = await lstat(expected.path, { bigint: true });
    assert(count === expected.bytes && hash.digest('hex') === expected.sha256);
    for (const key of ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs']) assert(before[key] === after[key] && after[key] === named[key]);
    return { ...expected, dev: String(before.dev), ino: String(before.ino) };
  } finally { await h.close(); }
}

/** Trusted code supplies runtime pins; JSON never supplies an environment or credential. No import/spawn/cleanup here. */
export function createNativeEnvironmentPolicy(runtime, { authenticationHome = 'private' } = {}) {
  assert(Array.isArray(runtime) && runtime.length === 3);
  assert(['private', 'normal-account'].includes(authenticationHome));
  const files = freeze(structuredClone(runtime));
  for (const row of files) assert(isAbsolute(row.path) && Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes < 268435456 && /^[a-f0-9]{64}$/.test(row.sha256));
  // This is a trusted code choice, never a path or account supplied by JSON.
  const normalAccount = authenticationHome === 'normal-account';
  const recipe = freeze({ kind: 'flow.o16.native-environment.v1', sdkVersion: '0.3.290', nativeVersion: '2.1.290', files,
    ...(normalAccount ? { authenticationHome: NORMAL_ACCOUNT_HOME } : {}),
    writePolicy: normalAccount ? { ...WRITE_POLICY, sharedHomeMayUpdate: true,
      homeIncludedInPrivateByteBudget: false, privateFiles: 'owned-config-tmp-materials; unused private home retained' } : WRITE_POLICY });
  const digest = recordDigest(recipe);
  async function verify(binding, source) {
    keys(binding, ['kind', 'sourceDigest', 'worktree', 'recipeDigest', 'phaseRoot', 'nativeRoot', 'folders', 'username', 'runtime']);
    assert(binding.kind === recipe.kind && binding.sourceDigest === source.digest && binding.worktree === source.root && binding.recipeDigest === digest);
    assert.equal(binding.username, userInfo().username); assert(/^[a-zA-Z0-9._-]{1,128}$/.test(binding.username));
    if (normalAccount) assert.equal(binding.username, NORMAL_ACCOUNT_HOME.username);
    assert.deepEqual(await directory(binding.phaseRoot.path), binding.phaseRoot);
    keys(binding.folders, ['home', 'config', 'tmp']);
    for (const name of ['home', 'config', 'tmp']) {
      assert.equal(binding.folders[name].path, join(binding.phaseRoot.path, 'native', name));
      assert.deepEqual(await directory(binding.folders[name].path), binding.folders[name]);
    }
    // Pin the intermediate directory too: its replacement must not redirect any measured subtree.
    assert.equal(binding.nativeRoot.path, join(binding.phaseRoot.path, 'native'));
    assert.deepEqual(await directory(binding.nativeRoot.path), binding.nativeRoot);
    assert.equal(binding.nativeRoot.dev, binding.phaseRoot.dev);
    assert.deepEqual(await Promise.all(files.map(fixedFile)), binding.runtime);
    return binding;
  }
  function environment(binding) {
    if (normalAccount) assert.equal(binding.username, NORMAL_ACCOUNT_HOME.username);
    return Object.freeze({ HOME: normalAccount ? NORMAL_ACCOUNT_HOME.path : binding.folders.home.path, CLAUDE_CONFIG_DIR: binding.folders.config.path,
      TMPDIR: binding.folders.tmp.path, CLAUDE_TMPDIR: binding.folders.tmp.path,
      CLAUDE_SECURESTORAGE_CONFIG_DIR: '', USER: binding.username, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C.UTF-8',
      DISABLE_AUTOUPDATER: '1', DISABLE_TELEMETRY: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' });
  }
  return Object.freeze({ recipe, digest, environment, verify,
    async prepare(phaseDirectory, source) {
      assert(/^[a-f0-9]{64}$/.test(source.digest) && isAbsolute(source.root));
      const phaseRoot = await directory(phaseDirectory), pinned = await Promise.all(files.map(fixedFile));
      await mkdir(join(phaseDirectory, 'native'), { mode: 0o700 });
      const folders = {};
      for (const name of ['home', 'config', 'tmp']) { const path = join(phaseDirectory, 'native', name); await mkdir(path, { mode: 0o700 }); folders[name] = await directory(path); }
      const binding = freeze({ kind: recipe.kind, sourceDigest: source.digest, worktree: source.root, recipeDigest: digest,
        phaseRoot, nativeRoot: await directory(join(phaseDirectory, 'native')), folders, username: userInfo().username, runtime: pinned });
      await verify(binding, source); return binding;
    },
    async queryInput(binding, source, input) {
      input.options.abortController.signal.throwIfAborted(); await verify(binding, source);
      const cwd = input.options.cwd; assert(typeof cwd === 'string' && cwd.startsWith(binding.phaseRoot.path + '/') && await realpath(cwd) === cwd);
      assert(input.options.persistSession === false && ['resume', 'continue', 'sessionStore', 'forkSession'].every(key => input.options[key] === undefined));
      input.options.abortController.signal.throwIfAborted();
      return { ...input, options: { ...input.options, env: environment(binding), pathToClaudeCodeExecutable: files[2].path } };
    },
  });
}
export const nativeEnvironmentPolicy = createNativeEnvironmentPolicy(FIXED_RUNTIME, { authenticationHome: 'normal-account' });

/** Metadata driver only: private import-time HOME/config/tmp; no authentication or inherited environment. */
export async function prepareDriverEnvironment(controlDirectory, run, phase) {
  const owner = await directory(controlDirectory), privateRoot = join(controlDirectory, 'driver-private');
  await mkdir(privateRoot, { mode: 0o700 });
  const folders = {};
  for (const name of ['home', 'config', 'tmp']) { const path = join(privateRoot, name); await mkdir(path, { mode: 0o700 }); folders[name] = await directory(path); }
  assert.deepEqual(await directory(controlDirectory), owner);
  return { owner, privateRoot: await directory(privateRoot), folders, environment: {
    HOME: folders.home.path, CLAUDE_CONFIG_DIR: folders.config.path, TMPDIR: folders.tmp.path,
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C.UTF-8', TSX_DISABLE_CACHE: '1', NODE_DISABLE_COMPILE_CACHE: '1',
    FLOW_O16_RUN: run, FLOW_O16_OPERATOR_PHASE: phase,
  } };
}
