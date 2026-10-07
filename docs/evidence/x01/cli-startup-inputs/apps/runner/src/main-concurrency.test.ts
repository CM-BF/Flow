import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  codex: vi.fn(), load: vi.fn(), publish: vi.fn(), guard: vi.fn(),
  native: vi.fn<(options: Record<string, unknown>) => Promise<void>>(),
  endpoints: vi.fn(), protocol: vi.fn(), engineering: vi.fn(), plugin: vi.fn(),
}));
vi.mock('./engineering/launch.js', () => ({ loadEngineeringRunner: dependencies.engineering }));
vi.mock('./configuration.js', () => ({ loadRunnerConfiguration: dependencies.load, loadCodexProductionRunnerConfiguration: dependencies.codex, loadPluginExecutionConfiguration: dependencies.plugin }));
vi.mock('./execution-profiles.js', () => ({ publishExecutionProfile: dependencies.publish, guardExecutionProfile: dependencies.guard }));
vi.mock('./runtime.js', () => ({ runRunner: dependencies.native }));
vi.mock('./protocol-dispatch/index.js', () => ({ loadProtocolEndpoints: dependencies.endpoints, runProtocolRunner: dependencies.protocol }));

const adapter = { name: 'fixture' };
let priorExitCode: typeof process.exitCode;
let priorSignals: number[];
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  priorExitCode = process.exitCode; process.exitCode = undefined;
  priorSignals = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')];
  vi.stubEnv('FLOW_PLUGIN_EXECUTION_CONFIG', undefined);
  vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', undefined);
  vi.stubEnv('FLOW_A2A_ENDPOINTS_FILE', undefined);
  vi.stubEnv('FLOW_ENGINEERING_SETUP_FILE', undefined);
  vi.stubEnv('FLOW_CODEX_PROFILE_FILE', undefined);
  vi.stubEnv('FLOW_CODEX_LAUNCH_FILE', undefined);
  vi.stubEnv('FLOW_CLAUDE_MATERIALS_FILE', '/synthetic-materials.json');
  vi.stubEnv('FLOW_URL', 'http://synthetic.invalid');
  vi.stubEnv('FLOW_RUNNER_TOKEN', 'synthetic-token');
  vi.stubEnv('FLOW_RUNNER_WORKDIR', '/synthetic-workdir');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  dependencies.load.mockResolvedValue({ harnesses: [{ adapter, descriptor: { publicProfile: null } }], profile: null, activeSteering: false });
  dependencies.plugin.mockResolvedValue(undefined);
  dependencies.native.mockResolvedValue();
  dependencies.endpoints.mockResolvedValue(['synthetic-endpoint']);
  dependencies.protocol.mockResolvedValue(undefined);
});
afterEach(() => {
  expect([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]).toEqual(priorSignals);
  process.exitCode = priorExitCode; vi.unstubAllEnvs(); vi.restoreAllMocks();
});
const start = () => import('./main.js');
const noStartup = () => {
  for (const dependency of Object.values(dependencies)) expect(dependency).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
};

describe('runner main concurrency entry', () => {
  it('passes the default local limit without changing configured adapters', async () => {
    await start();
    expect(dependencies.native).toHaveBeenCalledWith(expect.objectContaining({ maxConcurrentAttempts: 1, adapters: [adapter], activeSteering: false }));
    expect(dependencies.load).toHaveBeenCalledWith('/synthetic-materials.json');
    expect(dependencies.publish).not.toHaveBeenCalled();
    expect(dependencies.protocol).not.toHaveBeenCalled();
  });
  it('passes an explicit native limit while preserving profile publication and guards', async () => {
    vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', '4');
    const profile = { synthetic: 'configuration' }, reference = { synthetic: 'reference' }, guarded = { synthetic: 'guarded' };
    dependencies.load.mockResolvedValue({ harnesses: [{ adapter, descriptor: { publicProfile: profile } }], profile, activeSteering: true });
    dependencies.publish.mockResolvedValue(reference); dependencies.guard.mockReturnValue(guarded);
    await start();
    expect(dependencies.publish).toHaveBeenCalledWith(expect.objectContaining({ configuration: profile }));
    expect(dependencies.publish.mock.calls[0]![0]).not.toHaveProperty('maxConcurrentAttempts');
    expect(dependencies.guard).toHaveBeenCalledWith(adapter, reference, profile);
    expect(dependencies.native).toHaveBeenCalledWith(expect.objectContaining({ maxConcurrentAttempts: 4, adapters: [guarded], activeSteering: true }));
    expect(dependencies.native.mock.calls[0]![0]).not.toHaveProperty('capacity');
  });
  it.each(['', '0', '-1', '1.5', '1e0', ' 2 ', '17', '01', '1\n'])('rejects invalid native input %j before configuration or external startup', async raw => {
    vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', raw);
    await start(); noStartup();
  });
  it.each([undefined, '1'])('keeps A2A startup supported for %j', async raw => {
    vi.stubEnv('FLOW_A2A_ENDPOINTS_FILE', '/synthetic-endpoints.json');
    vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', raw);
    await start();
    expect(dependencies.endpoints).toHaveBeenCalledWith('/synthetic-endpoints.json');
    expect(dependencies.protocol).toHaveBeenCalledWith(expect.objectContaining({ endpoints: ['synthetic-endpoint'] }));
    expect(dependencies.protocol.mock.calls[0]![0]).not.toHaveProperty('maxConcurrentAttempts');
    expect(dependencies.load).not.toHaveBeenCalled();
    expect(dependencies.native).not.toHaveBeenCalled();
  });
  it.each(['2', '16', '', '1.0', ' 1'])('rejects unsupported A2A input %j before reading endpoint files', async raw => {
    vi.stubEnv('FLOW_A2A_ENDPOINTS_FILE', '/synthetic-endpoints.json');
    vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', raw);
    await start(); noStartup();
  });
  it.each(['SIGINT', 'SIGTERM'] as const)('keeps %s cancellation and removes both signal handlers after completion', async signalName => {
    const on = vi.spyOn(process, 'on');
    dependencies.native.mockImplementation(async options => {
      const stop = on.mock.calls.find(([signal]) => signal === signalName)![1];
      expect((options.signal as AbortSignal).aborted).toBe(false);
      stop();
      expect((options.signal as AbortSignal).aborted).toBe(true);
    });
    await start();
    expect(dependencies.native).toHaveBeenCalledOnce();
  });
  it('retains the fixed startup error without echoing rejected input', async () => {
    vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', 'sensitive-invalid-value');
    await start(); noStartup();
    expect(process.stderr.write).toHaveBeenCalledExactlyOnceWith('Runner stopped: check its configuration, center authentication and local event storage.\n');
  });
  it('sanitizes dependency failures and still releases the signal handlers', async () => {
    dependencies.native.mockRejectedValue(new Error('synthetic-private-dependency-error'));
    await start();
    expect(process.exitCode).toBe(1);
    expect(process.stderr.write).toHaveBeenCalledExactlyOnceWith('Runner stopped: check its configuration, center authentication and local event storage.\n');
  });
});


describe('dedicated engineering main entry', () => {
  function configure() {
    vi.stubEnv('FLOW_CLAUDE_MATERIALS_FILE', undefined);
    vi.stubEnv('FLOW_ENGINEERING_SETUP_FILE', '/synthetic-engineering.json');
    dependencies.engineering.mockResolvedValue(adapter);
  }
  it('composes only the pinned engineering adapter with the existing single-slot host', async () => {
    configure(); await start();
    expect(dependencies.engineering).toHaveBeenCalledWith(expect.objectContaining({ manifestFile: '/synthetic-engineering.json', workingDirectory: '/synthetic-workdir' }));
    expect(dependencies.native).toHaveBeenCalledWith(expect.objectContaining({ adapters: [adapter], maxConcurrentAttempts: 1 }));
    expect(dependencies.load).not.toHaveBeenCalled(); expect(dependencies.publish).not.toHaveBeenCalled(); expect(dependencies.protocol).not.toHaveBeenCalled();
  });
  it.each(['FLOW_CLAUDE_MATERIALS_FILE', 'FLOW_A2A_ENDPOINTS_FILE'])('refuses engineering plus %s before storage or publication', async name => {
    configure(); vi.stubEnv(name, '/other-config'); await start(); noStartup();
  });
  it('refuses parallel claims against one engineering project before startup', async () => {
    configure(); vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', '2'); await start(); noStartup();
  });
  it('does not enter the host after rejected setup and keeps startup errors private', async () => {
    configure(); dependencies.engineering.mockRejectedValue(new Error('private-storage-location')); await start();
    expect(dependencies.native).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
    expect(process.stderr.write).toHaveBeenCalledExactlyOnceWith('Runner stopped: check its configuration, center authentication and local event storage.\n');
  });
});

describe('persistent Codex main entry', () => {
  function configure() {
    vi.stubEnv('FLOW_CLAUDE_MATERIALS_FILE', undefined);
    vi.stubEnv('FLOW_CODEX_PROFILE_FILE', '/operator-profile.json');
    vi.stubEnv('FLOW_CODEX_LAUNCH_FILE', '/operator-launch.json');
    dependencies.codex.mockResolvedValue({ adapters: [adapter], activeSteering: false });
  }
  it('awaits the guarded publication loader once before running the selected adapters', async () => {
    configure(); vi.stubEnv('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS', '2');
    let release!: (value: unknown) => void;
    dependencies.codex.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const startup = start(); await vi.waitFor(() => expect(dependencies.codex).toHaveBeenCalledOnce());
    expect(dependencies.native).not.toHaveBeenCalled(); release({ adapters: [adapter] }); await startup;
    expect(dependencies.codex).toHaveBeenCalledWith(expect.objectContaining({ codexManifestFile: '/operator-profile.json', launchManifestFile: '/operator-launch.json', baseUrl: 'http://synthetic.invalid', token: 'synthetic-token' }));
    expect(dependencies.native).toHaveBeenCalledWith(expect.objectContaining({ adapters: [adapter], activeSteering: false, maxConcurrentAttempts: 2 }));
    expect(dependencies.publish).not.toHaveBeenCalled(); expect(dependencies.guard).not.toHaveBeenCalled(); expect(dependencies.load).not.toHaveBeenCalled();
  });
  it.each(['FLOW_CLAUDE_MATERIALS_FILE', 'FLOW_A2A_ENDPOINTS_FILE', 'FLOW_ENGINEERING_SETUP_FILE'])('rejects mixed %s before any loader or process', async name => {
    configure(); vi.stubEnv(name, '/other'); await start(); noStartup();
  });
  it.each(['FLOW_CODEX_PROFILE_FILE', 'FLOW_CODEX_LAUNCH_FILE'])('requires both explicit files, including empty %s', async name => {
    configure(); vi.stubEnv(name, ''); await start(); noStartup();
  });
  it('keeps unknown publication private and never starts the runner', async () => {
    configure(); dependencies.codex.mockRejectedValue(new Error('private recipe identity')); await start();
    expect(dependencies.native).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
    expect(process.stderr.write).toHaveBeenCalledExactlyOnceWith('Runner stopped: check its configuration, center authentication and local event storage.\n');
  });
  it.each(['SIGINT', 'SIGTERM'] as const)('passes %s to Codex startup and runner without leaving signal handlers', async name => {
    configure(); const on = vi.spyOn(process, 'on');
    dependencies.codex.mockImplementation(async options => { on.mock.calls.find(([signal]) => signal === name)![1](); expect(options.signal.aborted).toBe(true); throw new Error('aborted'); });
    await start(); expect(dependencies.native).not.toHaveBeenCalled(); expect(process.exitCode).toBe(1);
  });
});

describe('plugin operator startup', () => {
  it('passes one explicitly read trusted store to the same native runner without changing adapters', async () => {
    const pluginExecution = { store: { root: '/operator/materials', storeId: 'store', allowedDigests: ['a'.repeat(64)] } };
    vi.stubEnv('FLOW_PLUGIN_EXECUTION_CONFIG', '/private/operator.json'); dependencies.plugin.mockResolvedValue(pluginExecution);
    await start(); expect(dependencies.plugin).toHaveBeenCalledExactlyOnceWith('/private/operator.json');
    expect(dependencies.native).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pluginExecution, adapters: [adapter] }));
    expect(dependencies.protocol).not.toHaveBeenCalled();
  });
  it('keeps omission default-off and does not add a plugin property to legacy runRunner options', async () => {
    await start(); expect(dependencies.plugin).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(dependencies.native.mock.calls[0]![0]).not.toHaveProperty('pluginExecution');
  });
  it.each(['FLOW_A2A_ENDPOINTS_FILE','FLOW_ENGINEERING_SETUP_FILE','FLOW_CODEX_PROFILE_FILE'])('rejects plugin mixed with %s before reading or publishing', async name => {
    vi.stubEnv('FLOW_PLUGIN_EXECUTION_CONFIG','/operator.json'); vi.stubEnv(name,'/other.json'); await start(); noStartup();
  });
  it('never falls back from an explicitly empty or invalid private file', async () => {
    vi.stubEnv('FLOW_PLUGIN_EXECUTION_CONFIG',''); dependencies.plugin.mockRejectedValue(new Error('private rejected path'));
    await start(); expect(dependencies.plugin).toHaveBeenCalledExactlyOnceWith('');
    expect(dependencies.native).not.toHaveBeenCalled(); expect(dependencies.load).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1); expect(process.stderr.write).not.toHaveBeenCalledWith(expect.stringContaining('private rejected path'));
  });
});
