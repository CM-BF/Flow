// Executed only inside the future fixed artifact; imports never call factories or providers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, realpath, stat } from 'node:fs/promises';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = await realpath(process.argv[2]);
async function inside(path) {
  const resolved = await realpath(path), rel = relative(root, resolved);
  assert.ok(rel && !rel.startsWith('../') && rel !== '..' && !isAbsolute(rel));
  return resolved;
}
const hostRequire = createRequire(join(root, 'tools/personal-preview/preview.mjs'));
const pgEntry = await inside(hostRequire.resolve('pg'));
const runner = createRequire(join(root, 'apps/runner/package.json'));
const web = createRequire(join(root, 'apps/web/package.json'));
const sdkEntry = await inside(runner.resolve('@anthropic-ai/claude-agent-sdk'));
const sdk = JSON.parse(await readFile(join(dirname(sdkEntry), 'package.json'), 'utf8'));
assert.equal(sdk.version, '0.3.290');
const sdkRequire = createRequire(sdkEntry);
const nativeMetadata = await inside(sdkRequire.resolve('@anthropic-ai/claude-agent-sdk-darwin-arm64/package.json'));
assert.equal(JSON.parse(await readFile(nativeMetadata, 'utf8')).version, sdk.version);
const nativeBinary = await inside(join(dirname(nativeMetadata), 'claude'));
const nativeStat = await stat(nativeBinary); assert.ok(nativeStat.isFile() && nativeStat.size > 0 && nativeStat.mode & 0o111);
const viteEntry = await inside(web.resolve('vite'));
const tsxEntry = await inside(runner.resolve('tsx'));
const paths = ['apps/server/src/index.ts', 'apps/runner/src/runtime.ts', 'tools/personal-preview/backend-release/host.mjs', 'tools/personal-preview/preview.mjs', 'tools/personal-preview/maintenance-host.mjs'];
await new Promise(resolve => setTimeout(resolve, 25));
const [center, runtime, host, previewHost, maintenanceHost, vite, sdkModule] = await Promise.all([
  ...paths.map(async path => import(pathToFileURL(await inside(join(root, path))).href)),
  import(pathToFileURL(viteEntry).href), import(pathToFileURL(sdkEntry).href),
]);
assert.equal(typeof center.createServer, 'function');
assert.equal(typeof runtime.runRunner, 'function');
assert.equal(typeof host.backendRuntime, 'function');
assert.equal(typeof host.serviceRuntime, 'function');
const artifact = JSON.parse(await readFile(process.argv[4], 'utf8'));
const config = { directory: process.argv[3], repository: process.argv[5] };
const state = { backendArtifact: null, webHost: { artifact } };
const webRuntime = await host.serviceRuntime(config, state, 'web');
assert.equal(webRuntime.root, root);
assert.deepEqual(webRuntime.artifact, artifact);
const selections = [];
const select = async (_config, chosen) => { selections.push(chosen); return { selected: chosen }; };
await host.serviceRuntime(config, state, 'center', select);
await host.serviceRuntime(config, state, 'runner', select);
assert.deepEqual(selections, [null, null]);
await assert.rejects(host.backendRuntime({ ...config, repository: config.repository + '-wrong-source' }, artifact), { code: 'BACKEND_INSTALLATION_SOURCE_MISMATCH' });
assert.equal(typeof previewHost.loadPreviewConfiguration, 'function');
assert.equal(typeof maintenanceHost.maintainPreview, 'function');
assert.equal(typeof previewHost.assertPreviewMaintenanceRuntime, 'function');
const browserPolicy = await import(pathToFileURL(await inside(join(root, 'tools/personal-preview/browser-session-configuration.mjs'))).href);
const retention = await import(pathToFileURL(await inside(join(root, 'tools/personal-preview/web-retention-policy.mjs'))).href);
assert.equal(typeof browserPolicy.readBrowserSessionLaunch, 'function');
assert.equal(browserPolicy.browserCompatibilityContext(null), null);
assert.deepEqual(retention.WEB_RETENTION_POLICY, { artifacts: 4, assetBytes: 201326592, reports: 32, reportFileBytes: 4096, releaseBytes: 16384 });
assert.equal(typeof vite.preview, 'function');
assert.equal(typeof sdkModule.query, 'function');
console.log(JSON.stringify({ importsAndReadOnlySelectionOnly: true, newPolicyModulesLoaded: true, actualPolicyRead: false, artifactSourceRepository: config.repository, realWebArtifactSelected: true, centerRunnerSelectionPreserved: true, wrongSourceRejected: true, factoryCalls: 0, runnerCalls: 0, providerCalls: 0, sdkVersion: sdk.version, nativeBinaryExecuted: false, nativeBinaryBytes: nativeStat.size, resolved: { pgEntry, sdkEntry, nativeMetadata, nativeBinary, viteEntry, tsxEntry }, delayedImports: paths, developmentCheckoutIsolation: 'NO mutation or removal; internal resolution/inventory proof only' }));
