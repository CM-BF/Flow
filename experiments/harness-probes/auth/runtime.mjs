import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import * as filesystem from 'node:fs/promises';
import path from 'node:path';

const upstreamRoot = new URL('./upstream/', import.meta.url);
export const FIXED_NOW = 1_800_000_000_000;

// This loader is an experiment adapter, not a security sandbox for hostile code.
export async function createRuntime({ root, fetchImplementation, keychain = {}, hooks = {} }) {
  if (!path.isAbsolute(root) || typeof fetchImplementation !== 'function') throw new Error('Explicit temporary root and fake fetch are required.');
  const trace = { files: [], keychainReads: 0, keychainWrites: 0, forbiddenCalls: [] };
  const forbidden = name => { trace.forbiddenCalls.push(name); throw new Error(`Forbidden probe operation: ${name}`); };
  const checkedPath = filename => {
    const resolved = path.resolve(String(filename));
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return forbidden('filesystem-outside-temporary-root');
    return resolved;
  };
  const relative = filename => path.relative(root, String(filename));
  const files = {};
  for (const operation of ['readFile', 'mkdir', 'writeFile', 'chmod', 'rename']) {
    files[operation] = async (...args) => {
      checkedPath(args[0]);
      if (operation === 'rename') checkedPath(args[1]);
      trace.files.push({ operation, path: relative(args[0]), ...(operation === 'rename' ? { destination: relative(args[1]) } : {}) });
      await hooks.before?.(operation, args);
      const result = await filesystem[operation](...args);
      await hooks.after?.(operation, args);
      return result;
    };
  }
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
    static now() { return FIXED_NOW; }
  }
  const context = createContext({ Date: FixedDate, Buffer, URLSearchParams,
    process: Object.freeze({ pid: process.pid, platform: 'linux', env: Object.freeze({ USER: 'synthetic-user' }) }),
    fetch: () => forbidden('default-network-fetch'),
  });
  const modules = new Map();
  const synthetic = (id, exports) => {
    if (!modules.has(id)) modules.set(id, new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context, identifier: id }));
    return modules.get(id);
  };
  let utilityPromise;
  function utilities() {
    return utilityPromise ??= (async () => {
      const exports = {};
      for (const relativePath of ['oauth-access-token.ts', 'authentication-environment.ts', 'ai-gateway-auth.ts', 'os.ts', 'native-subscription/should-resolve-native.ts']) {
        Object.assign(exports, (await source(new URL(`harness/src/utils/${relativePath}`, upstreamRoot))).namespace);
      }
      exports.createCredentialRequestTransformation = () => forbidden('credential-request-transformation-outside-probe');
      exports.readMacOSKeychainPassword = async () => { trace.keychainReads += 1; return keychain.text; };
      return synthetic('@ai-sdk/harness/utils', exports);
    })();
  }
  async function source(url) {
    const id = url.href;
    if (modules.has(id)) return modules.get(id);
    if (!id.startsWith(upstreamRoot.href)) throw new Error('Unexpected source import');
    const text = await filesystem.readFile(url, 'utf8');
    const module = new SourceTextModule(stripTypeScriptTypes(text), { context, identifier: id });
    modules.set(id, module);
    await module.link(async (specifier, importer) => {
      if (specifier === 'node:fs/promises') return synthetic(specifier, files);
      if (specifier === 'node:fs') return synthetic(specifier, { readFileSync: () => forbidden('default-settings-file') });
      if (specifier === 'node:os') return synthetic(specifier, { homedir: () => forbidden('default-home-directory') });
      if (specifier === 'node:path') return synthetic(specifier, { dirname: path.dirname, join: path.join, resolve: path.resolve });
      if (specifier === 'node:child_process') return synthetic(specifier, { execFileSync: (command, args) => {
        if (command !== '/usr/bin/security' || args[0] !== 'add-generic-password') return forbidden('external-command');
        trace.keychainWrites += 1; keychain.text = args.at(-1); return Buffer.alloc(0);
      } });
      if (specifier === '@ai-sdk/provider-utils') return synthetic(specifier, {
        isRecord: value => value !== null && typeof value === 'object' && !Array.isArray(value),
        safeParseJSON: async ({ text: json }) => { try { return { success: true, value: JSON.parse(json) }; } catch { return { success: false }; } },
      });
      if (specifier === '@ai-sdk/harness/utils') return utilities();
      if (specifier.startsWith('.')) return source(new URL(`${specifier}.ts`, importer.identifier));
      throw new Error(`Unexpected import: ${specifier}`);
    });
    await module.evaluate();
    return module;
  }
  const subscription = (await source(new URL('harness-claude-code/src/claude-code-subscription.ts', upstreamRoot))).namespace;
  const oauth = (await source(new URL('harness/src/utils/oauth-access-token.ts', upstreamRoot))).namespace;
  const read = (options = {}) => subscription.readClaudeCodeSubscription({ homeDirectory: root,
    env: {}, platform: 'darwin', fetch: fetchImplementation, ...options });
  const resolve = (options = {}) => subscription.resolveClaudeCodeAuthentication({ auth: 'direct', processEnv: {},
    options: { readApiKeyHelper: () => forbidden('api-key-helper') }, readSubscription: () => read(), ...options });
  return { read, resolve, oauth, trace };
}
