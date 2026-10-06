import { useCallback, useId, useState, useSyncExternalStore } from 'react';
import type { FlowClient } from '@flow/client';
import type { PluginScope, PluginSnapshot, PluginVersion } from '@flow/contracts';
import type { PluginHost } from '../plugins/host';
import { useRead } from './use-read';
import './management.css';

export type PluginRegistryReader = Pick<FlowClient, 'plugins' | 'plugin' | 'pluginVersions' | 'pluginOperations'>;
export type LocalPluginSource = Pick<PluginHost, 'list' | 'subscribe'>;
export interface PluginManagementProps {
  open: boolean;
  sessionId: string;
  registry: PluginRegistryReader;
  runtime: LocalPluginSource;
  scope?: Pick<PluginScope, 'projectId'>;
  scopeLabel?: string;
}
const PAGE_SIZE = 10;

/** App-owned read view. It never receives or creates a PluginContext. */
export function PluginManagement(props: PluginManagementProps) {
  if (!props.open) return null;
  return <ManagementSession key={JSON.stringify([props.sessionId, props.scope?.projectId ?? null])} {...props} />;
}
function ManagementSession({ registry, runtime, scope, scopeLabel }: PluginManagementProps) {
  const [after, setAfter] = useState<string>();
  const projectId = scope?.projectId ?? null;
  return <section className="flow-plugin-management" aria-label="Plugin management">
    <section aria-label="Center registry" className="flow-registry">
      <header><h2>Center registry</h2><p>{projectId ? `Project registrations${scopeLabel ? ` · ${scopeLabel}` : ''}` : 'Personal workspace registrations'}</p></header>
      <p className="flow-plugin-note">Registered packages, public configuration and grants for this scope. Package code has not been verified or loaded by this center.</p>
      <RegistryPage key={after ?? 'first'} registry={registry} projectId={projectId} after={after} onPage={setAfter} />
    </section>
    <LocalPlugins runtime={runtime} />
  </section>;
}
function ReadNotice({ failed, retry, label }: { failed: boolean; retry(): void; label: string }) {
  return failed ? <div role="alert"><p>Could not load {label} from this center.</p><button type="button" onClick={retry}>Retry {label}</button></div>
    : <p role="status">Loading {label}…</p>;
}
function Paging({ next, after, label, onPage }: { next: string | null; after?: string; label: string; onPage(after?: string): void }) {
  return <nav className="flow-plugin-paging" aria-label={`${label} pages`}>
    {after ? <button type="button" onClick={() => onPage()}>First {label} page</button> : null}
    {next ? <button type="button" onClick={() => onPage(next)}>Next {label} page</button> : null}
  </nav>;
}
function RegistryPage({ registry, projectId, after, onPage }: { registry: PluginRegistryReader; projectId: string | null; after?: string; onPage(after?: string): void }) {
  const [selected, setSelected] = useState<string>();
  const load = useCallback((signal: AbortSignal) => registry.plugins({ projectId: projectId ?? undefined, after, limit: PAGE_SIZE }, signal), [registry, projectId, after]);
  const read = useRead(load);
  const detailId = useId();
  if (!read.data) return <ReadNotice {...read} label="registry" />;
  return <>
    <div className="flow-plugin-list-heading"><span>{read.data.installations.length} registrations on this page</span><button type="button" onClick={read.retry}>Refresh registry</button></div>
    {read.data.installations.length ? <ul className="flow-plugin-rows">{read.data.installations.map(item => <li key={item.id}>
      <button type="button" className="flow-plugin-row" aria-label={`View ${item.packageName}`} aria-expanded={selected === item.id} aria-controls={selected === item.id ? detailId : undefined}
        onClick={() => setSelected(current => current === item.id ? undefined : item.id)}>
        <span><strong>{item.packageName}</strong><small>Revision {item.revision}</small></span><span className="flow-plugin-status">Registered · runtime unavailable</span>
      </button>
      {selected === item.id ? <div id={detailId}><PluginDetails key={item.id} registry={registry} id={item.id} /></div> : null}
    </li>)}</ul> : <p>No plugins registered in this scope.</p>}
    <Paging next={read.data.nextCursor} after={after} label="registry" onPage={onPage} />
  </>;
}
function PluginDetails({ registry, id }: { registry: PluginRegistryReader; id: string }) {
  const [versions, showVersions] = useState(false);
  const [operations, showOperations] = useState(false);
  const load = useCallback((signal: AbortSignal) => registry.plugin(id, undefined, signal), [registry, id]);
  const read = useRead(load);
  const versionsId = useId(); const operationsId = useId();
  return <section className="flow-plugin-detail" aria-label="Registration details">
    {read.data ? <><Snapshot value={read.data} /><button type="button" onClick={read.retry}>Refresh registration</button></> : <ReadNotice {...read} label="registration" />}
    <div className="flow-plugin-history-controls">
      <button type="button" aria-expanded={versions} aria-controls={versionsId} onClick={() => showVersions(value => !value)}>{versions ? 'Hide versions' : 'Show versions'}</button>
      <button type="button" aria-expanded={operations} aria-controls={operationsId} onClick={() => showOperations(value => !value)}>{operations ? 'Hide audit history' : 'Show audit history'}</button>
    </div>
    {versions ? <section id={versionsId} aria-label="Registered versions"><Versions registry={registry} id={id} /></section> : null}
    {operations ? <section id={operationsId} aria-label="Registration audit"><Operations registry={registry} id={id} /></section> : null}
  </section>;
}
function Snapshot({ value }: { value: PluginSnapshot }) {
  return <>
    <h3>Registration revision {value.revision}</h3>
    <dl className="flow-plugin-facts">
      <dt>Selected version</dt><dd>{value.version.packageVersion}</dd>
      <dt>Runtime</dt><dd>Unavailable: package has not been verified or loaded.</dd>
      <dt>Configuration</dt><dd>{value.configurationStatus === 'ready' ? 'Ready' : 'Incomplete'}</dd>
      <dt>Granted categories</dt><dd>{value.grants.length ? value.grants.join(', ') : 'None'}</dd>
    </dl>
    <h4>Public configuration</h4>
    {Object.keys(value.configuration).length ? <dl className="flow-plugin-facts" aria-label="Public configuration">{Object.entries(value.configuration).map(([key, setting]) => <div key={key}><dt>{key}</dt><dd>{String(setting)}</dd></div>)}</dl> : <p>No public values configured.</p>}
    <p className="flow-plugin-note">These grants describe center registry categories. Browser extension permissions and activation are managed separately.</p>
  </>;
}
function Version({ value }: { value: PluginVersion }) {
  return <li><strong>{value.packageVersion}</strong><dl className="flow-plugin-facts">
    <dt>License</dt><dd>{value.license}</dd><dt>Declared categories</dt><dd>{value.capabilities.join(', ') || 'None'}</dd>
    <dt>Declared SHA-256</dt><dd className="flow-plugin-digest">{value.declaredSha256}</dd>
    <dt>Declared on</dt><dd><time dateTime={value.createdAt}>{new Date(value.createdAt).toLocaleString()}</time></dd>
  </dl></li>;
}
function Versions({ registry, id }: { registry: PluginRegistryReader; id: string }) {
  const [after, onPage] = useState<string>();
  return <VersionPage key={after ?? 'first'} registry={registry} id={id} after={after} onPage={onPage} />;
}
function VersionPage({ registry, id, after, onPage }: { registry: PluginRegistryReader; id: string; after?: string; onPage(after?: string): void }) {
  const load = useCallback((signal: AbortSignal) => registry.pluginVersions(id, { after, limit: PAGE_SIZE }, signal), [registry, id, after]);
  const read = useRead(load);
  if (!read.data) return <ReadNotice {...read} label="versions" />;
  return <><h4>Declared versions</h4>{read.data.versions.length ? <ul className="flow-plugin-history">{read.data.versions.map(value => <Version key={value.id} value={value} />)}</ul> : <p>No versions recorded.</p>}
    <Paging label="versions" after={after} next={read.data.nextCursor} onPage={onPage} /></>;
}
function Operations({ registry, id }: { registry: PluginRegistryReader; id: string }) {
  const [after, onPage] = useState<string>();
  return <OperationPage key={after ?? 'first'} registry={registry} id={id} after={after} onPage={onPage} />;
}
function OperationPage({ registry, id, after, onPage }: { registry: PluginRegistryReader; id: string; after?: string; onPage(after?: string): void }) {
  const load = useCallback((signal: AbortSignal) => registry.pluginOperations(id, { after, limit: PAGE_SIZE }, signal), [registry, id, after]);
  const read = useRead(load);
  if (!read.data) return <ReadNotice {...read} label="audit history" />;
  const titles = { register: 'Registration', configure: 'Configuration changed', 'set-grants': 'Grants changed', 'register-version': 'Version declared', 'select-version': 'Version selected' };
  return <><h4>Revision audit</h4>{read.data.operations.length ? <ol className="flow-plugin-history">{read.data.operations.map(item => <li key={item.id}>
    <strong>{titles[item.kind]}</strong><p>Revision {item.beforeRevision ?? '—'} → {item.afterRevision} · {item.actor} · {item.status}</p>
    <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
  </li>)}</ol> : <p>No operations recorded.</p>}<Paging label="audit" after={after} next={read.data.nextCursor} onPage={onPage} /></>;
}
function LocalPlugins({ runtime }: { runtime: LocalPluginSource }) {
  const items = useSyncExternalStore(runtime.subscribe, runtime.list, runtime.list);
  return <section className="flow-plugin-local" aria-label="Browser extensions"><header><h2>This browser connection</h2><p>Trusted local extensions</p></header>
    <p className="flow-plugin-note">Live state from this connection's host. Center registration does not load or activate these extensions.</p>
    {items.length ? <ul className="flow-plugin-rows">{items.map(item => <li key={item.id}><div className="flow-plugin-row"><span><strong>{item.id}</strong><small>Version {item.version}</small></span><span className="flow-plugin-status">{item.state}</span></div>{item.error ? <p className="flow-plugin-error">{item.error}</p> : null}</li>)}</ul> : <p>No local extensions registered in this connection.</p>}
  </section>;
}
