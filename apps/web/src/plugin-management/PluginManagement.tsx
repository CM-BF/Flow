import { useCallback, useId, useState, useSyncExternalStore } from 'react';
import type { FlowClient } from '@flow/client';
import type { PluginMaterialInstall, PluginRuntimeView, PluginScope, PluginSnapshot, PluginVersion } from '@flow/contracts';
import type { PluginHost } from '../plugins/host';
import { readRuntimeForView, selectRuntimeForView, type PluginRuntimeReader, type RuntimeCommandController } from './runtime-command';
import { useRead } from './use-read';
import './management.css';

export type PluginRegistryReader = Pick<FlowClient, 'plugins' | 'plugin' | 'pluginVersions' | 'pluginOperations'>;
export type LocalPluginSource = Pick<PluginHost, 'list' | 'subscribe'>;
export interface CenterRuntimeManagement {
  reader: PluginRuntimeReader;
  commands: RuntimeCommandController;
}
export interface PluginManagementProps {
  open: boolean;
  sessionId: string;
  registry: PluginRegistryReader;
  runtime: LocalPluginSource;
  scope?: Pick<PluginScope, 'projectId'>;
  scopeLabel?: string;
  /** Created and revoked by the host session, outside this lazy view. */
  centerRuntime?: CenterRuntimeManagement;
}
const PAGE_SIZE = 10;

/** Host-owned management view. It never receives or creates a PluginContext. */
export function PluginManagement(props: PluginManagementProps) {
  if (!props.open) return null;
  return <ManagementSession key={JSON.stringify([props.sessionId, props.scope?.projectId ?? null])} {...props} />;
}
function ManagementSession({ registry, runtime, scope, scopeLabel, sessionId, centerRuntime }: PluginManagementProps) {
  const [after, setAfter] = useState<string>();
  const projectId = scope?.projectId ?? null;
  const boundRuntime = centerRuntime?.commands.sessionId === sessionId ? centerRuntime : undefined;
  return <section className="flow-plugin-management" aria-label="Plugin management">
    <section aria-label="Center registry" className="flow-registry">
      <header><h2>Center registry</h2><p>{projectId ? `Project registrations${scopeLabel ? ` · ${scopeLabel}` : ''}` : 'Personal workspace registrations'}</p></header>
      <p className="flow-plugin-note">Public registration, configuration and grants. Registration alone does not prove that package code is loaded or callable.</p>
      {boundRuntime ? <RuntimeCommandNotice commands={boundRuntime.commands} /> : null}
      {centerRuntime && !boundRuntime ? <p role="alert">管理会话已变化，启停入口不可用。</p> : null}
      <RegistryPage registry={registry} projectId={projectId} after={after} onPage={setAfter} centerRuntime={boundRuntime} />
    </section>
    <LocalPlugins runtime={runtime} />
  </section>;
}
function ReadNotice({ failed, retry, label }: { failed: boolean; retry(): void; label: string }) {
  return failed ? <div role="alert"><p>Could not load {label} from this center.</p><button type="button" onClick={retry}>Retry {label}</button></div>
    : <p role="status">Loading {label}…</p>;
}
function Paging({ next, after, label, busy, onPage }: { next: string | null; after?: string; label: string; busy: boolean; onPage(after?: string): void }) {
  return <nav className="flow-plugin-paging" aria-label={`${label} pages`}>
    <button type="button" aria-disabled={!after || busy} onClick={() => { if (after && !busy) onPage(); }}>First {label} page</button>
    <button type="button" aria-disabled={!next || busy} onClick={() => { if (next && !busy) onPage(next); }}>Next {label} page</button>
  </nav>;
}
function RegistryPage({ registry, projectId, after, onPage, centerRuntime }: { registry: PluginRegistryReader; projectId: string | null; after?: string; onPage(after?: string): void; centerRuntime?: CenterRuntimeManagement }) {
  const [selected, setSelected] = useState<string>();
  const load = useCallback((signal: AbortSignal) => registry.plugins({ projectId: projectId ?? undefined, after, limit: PAGE_SIZE }, signal), [registry, projectId, after]);
  const read = useRead(load);
  const detailId = useId();
  if (!read.data) return <ReadNotice {...read} label="registry" />;
  return <>
    {read.failed ? <ReadNotice {...read} label="registry" /> : read.pending ? <p role="status">Updating registry…</p> : null}
    <div className="flow-plugin-list-heading"><span>{read.data.installations.length} registrations on this page</span><button type="button" aria-disabled={read.pending} onClick={() => { if (!read.pending) read.retry(); }}>Refresh registry</button></div>
    {read.data.installations.length ? <ul className="flow-plugin-rows">{read.data.installations.map(item => <li key={item.id}>
      <button type="button" className="flow-plugin-row" aria-label={`View ${item.packageName}`} aria-disabled={read.pending || read.failed} aria-expanded={selected === item.id} aria-controls={selected === item.id ? detailId : undefined}
        onClick={() => { if (!read.pending && !read.failed) setSelected(current => current === item.id ? undefined : item.id); }}>
        <span><strong>{item.packageName}</strong><small>Revision {item.revision}</small></span><span className="flow-plugin-status">{centerRuntime ? 'Registered · 查看中心启停状态' : 'Registered · runtime unavailable'}</span>
      </button>
      {selected === item.id ? <div id={detailId}><PluginDetails key={item.id} registry={registry} id={item.id} centerRuntime={centerRuntime} /></div> : null}
    </li>)}</ul> : <p>No plugins registered in this scope.</p>}
    <Paging next={read.data.nextCursor} after={after} label="registry" busy={read.pending || read.failed} onPage={cursor => { setSelected(undefined); onPage(cursor); }} />
  </>;
}
function PluginDetails({ registry, id, centerRuntime }: { registry: PluginRegistryReader; id: string; centerRuntime?: CenterRuntimeManagement }) {
  const [versions, showVersions] = useState(false);
  const [operations, showOperations] = useState(false);
  const load = useCallback((signal: AbortSignal) => registry.plugin(id, undefined, signal), [registry, id]);
  const read = useRead(load);
  const versionsId = useId(); const operationsId = useId();
  return <section className="flow-plugin-detail" aria-label="Registration details">
    {read.data ? <>{read.failed ? <ReadNotice {...read} label="registration" /> : read.pending ? <p role="status">Updating registration…</p> : null}<Snapshot value={read.data} hasRuntime={Boolean(centerRuntime)} /><button type="button" aria-disabled={read.pending} onClick={() => { if (!read.pending) read.retry(); }}>Refresh registration</button>
      {centerRuntime ? <RuntimeControls access={centerRuntime} snapshot={read.data} registrationCurrent={!read.failed && !read.pending} /> : null}</> : <ReadNotice {...read} label="registration" />}
    <div className="flow-plugin-history-controls">
      <button type="button" aria-expanded={versions} aria-controls={versionsId} onClick={() => showVersions(value => !value)}>{versions ? 'Hide versions' : 'Show versions'}</button>
      <button type="button" aria-expanded={operations} aria-controls={operationsId} onClick={() => showOperations(value => !value)}>{operations ? 'Hide audit history' : 'Show audit history'}</button>
    </div>
    {versions ? <section id={versionsId} aria-label="Registered versions"><Versions registry={registry} id={id} /></section> : null}
    {operations ? <section id={operationsId} aria-label="Registration audit"><Operations registry={registry} id={id} /></section> : null}
  </section>;
}
function Snapshot({ value, hasRuntime = false }: { value: PluginSnapshot; hasRuntime?: boolean }) {
  return <>
    <h3>Registration revision {value.revision}</h3>
    <dl className="flow-plugin-facts">
      <dt>Selected version</dt><dd>{value.version.packageVersion}</dd>
      <dt>Runtime</dt><dd>{hasRuntime ? '实际加载与可调用状态未知；中心启停状态见下方。' : 'Unavailable: package has not been verified or loaded.'}</dd>
      <dt>Configuration</dt><dd>{value.configurationStatus === 'ready' ? 'Ready' : 'Incomplete'}</dd>
      <dt>Granted categories</dt><dd>{value.grants.length ? value.grants.join(', ') : 'None'}</dd>
    </dl>
    <h4>Public configuration</h4>
    {Object.keys(value.configuration).length ? <dl className="flow-plugin-facts" aria-label="Public configuration">{Object.entries(value.configuration).map(([key, setting]) => <div key={key}><dt>{key}</dt><dd>{String(setting)}</dd></div>)}</dl> : <p>No public values configured.</p>}
    <p className="flow-plugin-note">These grants describe center registry categories. Browser extension permissions and activation are managed separately.</p>
  </>;
}

function RuntimeCommandNotice({ commands }: { commands: RuntimeCommandController }) {
  const state = useSyncExternalStore(commands.subscribe, commands.getSnapshot, commands.getSnapshot);
  if (state.phase === 'idle') return state.notice === 'invalid-input' ? <p role="alert">输入不符合公开命令格式，未发送。请检查原因和执行后端 UUID。</p> : null;
  return <section aria-label="插件启停命令" className="flow-plugin-detail">
    <p role="status">{state.phase === 'sending' ? '正在提交，不能重复发起。' : state.phase === 'unknown' ? '启停结果未知：原命令已保留。读取状态不能确认这次写入。' : state.phase === 'accepted' ? '中心已确认启停命令；这不证明代码已加载或可调用。' : state.phase === 'rejected' ? `中心明确拒绝本次新命令（${state.rejectionStatus}），输入保留。` : '原管理会话已结束，旧命令不能在新会话重试。'}</p>
    {state.command ? <details><summary>原命令身份</summary><dl className="flow-plugin-facts">
      <dt>Registration</dt><dd>{state.command.registrationId}</dd><dt>Expected revision</dt><dd>{state.command.input.expectedRevision}</dd>
      <dt>Action</dt><dd>{state.command.input.change.kind}</dd><dt>Idempotency key</dt><dd>{state.command.key}</dd>
    </dl></details> : null}
    {state.phase === 'unknown' && state.command ? <button type="button" onClick={() => { if (state.command) void commands.retryOriginal(state.command); }}>重试原启停命令</button> : null}
    {state.retryRejectionStatus ? <p>重试返回 {state.retryRejectionStatus}，不能否定第一次写入；原命令仍待确认。</p> : null}
  </section>;
}

const runtimeReasons: Record<PluginRuntimeView['reason'], string> = {
  'not-enabled': '尚未启用', 'revision-changed': '注册版本已变化，需要重新确认',
  'configuration-incomplete': '公开配置未完整', 'grant-missing': '中心授权不足',
  'host-unavailable': '执行后端当前不可用', ready: '中心允许创建新的工具绑定',
};
function materialIssue(value: PluginMaterialInstall, snapshot: PluginSnapshot): string | undefined {
  if (value.registrationId !== snapshot.installation.id || value.versionId !== snapshot.version.id) return '不属于当前注册版本';
  if (value.status !== 'installed') return `安装状态：${value.status}`;
  if (value.hostApiMajor !== 1 || !value.materialId || !value.treeDigest) return '完整安装身份尚不可用';
  return undefined;
}
function RuntimeControls({ access, snapshot, registrationCurrent }: { access: CenterRuntimeManagement; snapshot: PluginSnapshot; registrationCurrent: boolean }) {
  const state = useSyncExternalStore(access.commands.subscribe, access.commands.getSnapshot, access.commands.getSnapshot);
  const registrationId = snapshot.installation.id;
  const original = state.command?.registrationId === registrationId ? state.command.input : undefined;
  const [runner, setRunner] = useState(original?.change.kind === 'enable' ? original.change.targetRunnerId : '');
  const [selected, setSelected] = useState(original?.change.kind === 'enable' ? original.change.materialInstallOperationId : '');
  const [reason, setReason] = useState(original?.reason ?? '');
  const [after, setAfter] = useState<string>();
  const loadRuntime = useCallback((signal: AbortSignal) => readRuntimeForView(access.reader, access.commands, registrationId, signal), [access.reader, access.commands, registrationId]);
  const loadMaterials = useCallback((signal: AbortSignal) => access.reader.pluginMaterialInstalls(registrationId, { after, limit: PAGE_SIZE }, signal), [access.reader, registrationId, after]);
  const runtime = useRead(loadRuntime); const materials = useRead(loadMaterials);
  const acknowledged = state.acknowledgement?.snapshot.installation.id === registrationId ? state.acknowledgement : undefined;
  const value = selectRuntimeForView(registrationId, acknowledged, runtime.data);
  const currentSnapshot = acknowledged && acknowledged.snapshot.revision >= snapshot.revision ? acknowledged.snapshot : snapshot;
  const pending = state.phase === 'sending' || state.phase === 'unknown' || state.phase === 'revoked';
  const readCurrent = registrationCurrent && !runtime.failed && !runtime.pending && Boolean(value);
  const material = materials.data?.operations.find(item => item.id === selected);
  const canEnable = readCurrent && !pending && !materials.failed && !materials.pending && material && !materialIssue(material, currentSnapshot) && runner.trim() && reason.trim();
  return <section aria-label="中心插件运行时">
    <h4>中心插件启停</h4>
    {value ? <><dl className="flow-plugin-facts">
      <dt>期望启用</dt><dd>{value.desiredEnabled ? '是' : '否'}</dd><dt>可创建绑定</dt><dd>{value.bindingAllowed ? '是' : '否'}</dd>
      <dt>原因</dt><dd>{runtimeReasons[value.reason]}</dd><dt>观察版本</dt><dd>{value.currentRevision}</dd>
      <dt>已加载 / 可调用</dt><dd>未知 / 未知</dd>
      <dt>当前执行后端</dt><dd>{value.targetRunnerId ?? '未绑定'}</dd><dt>当前 Store</dt><dd>{value.storeId ?? '未绑定'}</dd>
    </dl>{!readCurrent ? <p role="status">当前读取未确认；保留的展示不构成新授权。</p> : null}</> : null}
    {runtime.failed || !runtime.data ? <ReadNotice {...runtime} label="runtime" /> : null}
    <button type="button" disabled={runtime.pending} onClick={runtime.retry}>刷新启停状态（只读）</button>
    <p className="flow-plugin-note">启用仍由中心检查兼容性与授权，不表示在线、已加载或调用获准。配置与 grants 在本片只读。</p>
    <details><summary>高级执行后端与完整安装身份</summary>
      <p className="flow-plugin-note">临时高级入口：输入已登记执行后端的精确 UUID，不自动注册。按可读名称选择授权候选尚待公共接口。</p>
      <label>执行后端 UUID<input aria-label="执行后端 UUID" value={runner} disabled={pending} maxLength={36} onChange={event => setRunner(event.target.value)} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} /></label>
      {materials.data ? <fieldset disabled={pending || materials.pending || materials.failed} style={{ minWidth: 0 }}><legend>选择精确安装</legend>
        {materials.data.operations.map(item => { const issue = materialIssue(item, currentSnapshot); return <label key={item.id} style={{ display: 'block', overflowWrap: 'anywhere' }}>
          <input type="radio" name={`material-${registrationId}`} value={item.id} checked={selected === item.id} disabled={Boolean(issue)} onChange={() => setSelected(item.id)} />
          {item.id} · {item.storeId}{issue ? ` · 不可选：${issue}` : ''}
          <dl className="flow-plugin-facts"><dt>Version identity</dt><dd>{item.versionId}</dd><dt>Artifact</dt><dd>{item.artifactId}</dd><dt>Material</dt><dd>{item.materialId ?? '未知'}</dd><dt>Tree digest</dt><dd>{item.treeDigest ?? '未知'}</dd><dt>Host API</dt><dd>{item.hostApiMajor ?? '未知'}</dd></dl>
        </label>; })}
        {!materials.data.operations.length ? <p>尚无安装记录，不能启用。</p> : null}
      </fieldset> : null}
      {materials.failed || !materials.data ? <ReadNotice {...materials} label="installed material" /> : null}
      <button type="button" disabled={materials.pending} onClick={materials.retry}>刷新安装记录（只读）</button>
      <Paging label="installed materials" after={after} next={materials.data?.nextCursor ?? null} busy={materials.pending || materials.failed} onPage={setAfter} />
      {selected && !material ? <p>所选安装不在当前页；未替换选择，请返回其所在页再确认。</p> : null}
    </details>
    <label>变更原因<textarea aria-label="变更原因" value={reason} disabled={pending} maxLength={512} onChange={event => setReason(event.target.value)} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} /></label>
    <div className="flow-plugin-history-controls">
      <button type="button" disabled={!canEnable} onClick={() => { if (canEnable && value && material) void access.commands.submit(registrationId, { expectedRevision: value.currentRevision, reason, change: { kind: 'enable', materialInstallOperationId: material.id, storeId: material.storeId, targetRunnerId: runner } }); }}>确认启用</button>
      <button type="button" disabled={!readCurrent || pending || !reason.trim() || !value?.desiredEnabled} onClick={() => { if (readCurrent && !pending && value?.desiredEnabled && reason.trim()) void access.commands.submit(registrationId, { expectedRevision: value.currentRevision, reason, change: { kind: 'disable' } }); }}>确认停用</button>
    </div>
  </section>;
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
  return <VersionPage registry={registry} id={id} after={after} onPage={onPage} />;
}
function VersionPage({ registry, id, after, onPage }: { registry: PluginRegistryReader; id: string; after?: string; onPage(after?: string): void }) {
  const load = useCallback((signal: AbortSignal) => registry.pluginVersions(id, { after, limit: PAGE_SIZE }, signal), [registry, id, after]);
  const read = useRead(load);
  if (!read.data) return <ReadNotice {...read} label="versions" />;
  return <>{read.failed ? <ReadNotice {...read} label="versions" /> : read.pending ? <p role="status">Updating versions…</p> : null}<h4>Declared versions</h4>{read.data.versions.length ? <ul className="flow-plugin-history">{read.data.versions.map(value => <Version key={value.id} value={value} />)}</ul> : <p>No versions recorded.</p>}
    <Paging label="versions" after={after} next={read.data.nextCursor} busy={read.pending || read.failed} onPage={onPage} /></>;
}
function Operations({ registry, id }: { registry: PluginRegistryReader; id: string }) {
  const [after, onPage] = useState<string>();
  return <OperationPage registry={registry} id={id} after={after} onPage={onPage} />;
}
function OperationPage({ registry, id, after, onPage }: { registry: PluginRegistryReader; id: string; after?: string; onPage(after?: string): void }) {
  const load = useCallback((signal: AbortSignal) => registry.pluginOperations(id, { after, limit: PAGE_SIZE }, signal), [registry, id, after]);
  const read = useRead(load);
  if (!read.data) return <ReadNotice {...read} label="audit history" />;
  const titles = { register: 'Registration', configure: 'Configuration changed', 'set-grants': 'Grants changed', 'register-version': 'Version declared', 'select-version': 'Version selected', enable: 'Enabled for new tool tasks', disable: 'Disabled for new tool tasks' };
  return <>{read.failed ? <ReadNotice {...read} label="audit history" /> : read.pending ? <p role="status">Updating audit history…</p> : null}<h4>Revision audit</h4>{read.data.operations.length ? <ol className="flow-plugin-history">{read.data.operations.map(item => <li key={item.id}>
    <strong>{titles[item.kind]}</strong><p>Revision {item.beforeRevision ?? '—'} → {item.afterRevision} · {item.actor} · {item.status}</p>
    <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
  </li>)}</ol> : <p>No operations recorded.</p>}<Paging label="audit" after={after} next={read.data.nextCursor} busy={read.pending || read.failed} onPage={onPage} /></>;
}
function LocalPlugins({ runtime }: { runtime: LocalPluginSource }) {
  const items = useSyncExternalStore(runtime.subscribe, runtime.list, runtime.list);
  return <section className="flow-plugin-local" aria-label="Browser extensions"><header><h2>This browser connection</h2><p>Trusted local extensions</p></header>
    <p className="flow-plugin-note">Live state from this connection's host. Center registration does not load or activate these extensions.</p>
    {items.length ? <ul className="flow-plugin-rows">{items.map(item => <li key={item.id}><div className="flow-plugin-row"><span><strong>{item.id}</strong><small>Version {item.version}</small></span><span className="flow-plugin-status">{item.state}</span></div>{item.error ? <p className="flow-plugin-error">{item.error}</p> : null}</li>)}</ul> : <p>No local extensions registered in this connection.</p>}
  </section>;
}
