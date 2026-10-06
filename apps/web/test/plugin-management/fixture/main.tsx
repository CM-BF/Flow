import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FlowClient } from '@flow/client';
import { PluginManagement, type PluginRegistryReader } from '../../../src/plugin-management/PluginManagement';
import { PluginHost } from '../../../src/plugins/host';
import { createStore } from '../../../src/plugin-integration/session';
import type { NavigationSnapshot, PluginContext, ThemeSnapshot } from '../../../src/plugins/types';
import '../../../src/assistant-ui.css';
import '../../../src/styles.css';
import './style.css';

declare global {
  interface Window {
    __X03_INPUT__: { centers: string[]; token: string; projectId: string; emptyProjectId: string };
    __X03_TEST__: { aborted: number; contextKeys: string[]; holdNextDetail: boolean; detailReady?: boolean; release?: () => void };
  }
}
window.__X03_TEST__ = { aborted: 0, contextKeys: [], holdNextDetail: false };
function makeHost() {
  const host = new PluginHost({
    navigation: createStore<NavigationSnapshot>({ activeTaskId: null, workspaceTab: 'files', workspaceOpen: false }),
    theme: createStore<ThemeSnapshot>({ themeId: 'light', scheme: 'light', availableThemes: [] }),
    getContext: () => ({ kind: 'global' }), authorize: () => true, execute: async () => {},
  });
  for (const id of ['trusted.example', 'broken.example']) host.register({
    manifest: { id, version: '1.0.0', hostApi: 1, capabilities: [], activationEvents: [], commands: [], contributions: [] },
    load: async () => ({ activate(context: PluginContext) {
      window.__X03_TEST__.contextKeys = Object.keys(context);
      if (id === 'broken.example') throw new Error('Fixture activation failed.');
    } }),
  });
  return host;
}
function App() {
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState(0);
  const [project, setProject] = useState<false | 'project' | 'empty'>(false);
  const [dark, setDark] = useState(false);
  const runtime = useMemo(makeHost, [center]);
  const registry = useMemo<PluginRegistryReader>(() => {
    const client = new FlowClient({ baseUrl: window.__X03_INPUT__.centers[center]!, token: window.__X03_INPUT__.token });
    const watch = (signal?: AbortSignal) => signal?.addEventListener('abort', () => window.__X03_TEST__.aborted++);
    return {
      plugins(options, signal) { watch(signal); return client.plugins(options, signal); },
      async plugin(id, revision, signal) {
        watch(signal);
        const hold = window.__X03_TEST__.holdNextDetail;
        window.__X03_TEST__.holdNextDetail = false;
        const pause = hold ? new Promise<void>(resolve => { window.__X03_TEST__.release = resolve; }) : Promise.resolve();
        const result = await client.plugin(id, revision, signal);
        if (hold) window.__X03_TEST__.detailReady = true;
        await pause; // Controlled consumer deliberately ignores abort after HTTP has completed.
        return result;
      },
      pluginVersions(id, options, signal) { watch(signal); return client.pluginVersions(id, options, signal); },
      pluginOperations(id, options, signal) { watch(signal); return client.pluginOperations(id, options, signal); },
    };
  }, [center]);
  return <main className="fixture-shell">
    <h1>Isolated plugin management fixture</h1>
    <p>Real local centers and trusted browser host; this is not the Flow App entry.</p>
    <nav aria-label="Fixture controls">
      <button onClick={() => setOpen(value => !value)}>{open ? 'Close plugin management' : 'Open plugin management'}</button>
      <button onClick={() => { void runtime.dispose(); setCenter(value => 1 - value); }}>Switch center</button>
      <button onClick={() => setProject(value => value ? false : 'project')}>{project ? 'Use personal scope' : 'Use project scope'}</button>
      <button onClick={() => setProject('empty')}>Use empty scope</button>
      <button onClick={() => { document.documentElement.classList.toggle('dark', !dark); setDark(!dark); }}>Use {dark ? 'light' : 'dark'} theme</button>
      <button onClick={() => void runtime.activate('trusted.example')}>Activate trusted extension</button>
      <button onClick={() => void runtime.deactivate('trusted.example')}>Disable trusted extension</button>
      <button onClick={() => void runtime.activate('broken.example')}>Fail extension</button>
    </nav>
    <p aria-label="Fixture center">Center {center === 0 ? 'A' : 'B'}</p>
    <PluginManagement open={open} sessionId={`fixture-center-${center}`} registry={registry} runtime={runtime}
      scope={{ projectId: project === 'empty' ? window.__X03_INPUT__.emptyProjectId : project ? window.__X03_INPUT__.projectId : null }} scopeLabel={project === 'empty' ? 'Empty project' : project ? 'Design review' : undefined} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
