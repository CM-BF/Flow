import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CLAUDE_TURN_SETTINGS_PROTOCOL, claudeTurnSettingsJson, type ClaudeTurnSettings, type ConversationCreation } from "@flow/contracts";
import { Button } from "../components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import type { ExecutionProfileCatalogSnapshot, MessageSettingsCatalogSnapshot } from "./catalog";
import { captureMessageSettings, messageSettingsAvailability, sameMessageSettings, configuredSelection, isChatAccess, legacyDefaultSelection, type Immutable, type MessageSettingsContext, type ProfileSelection } from "./selection";
import "./execution-profiles.css";

export interface ExecutionProfilePickerProps {
  catalog: ExecutionProfileCatalogSnapshot;
  selection: ProfileSelection;
  onSelect(selection: ProfileSelection): void;
  onRefresh(): void;
  onLoadMore(): void;
  details?: (navigate: (action: () => void) => void) => ReactNode;
  locked?: { creation: ConversationCreation; reason: "created" | "receipt-pending" };
}

function useProfileDialog() {
  const [open, setOpen] = useState(false);
  const navigation = useRef<(() => void) | null>(null);
  return {
    open, onOpenChange: setOpen,
    navigate: (action: () => void) => { navigation.current = action; setOpen(false); },
    onCloseAutoFocus: (event: Event) => {
      const action = navigation.current; navigation.current = null;
      if (action) { event.preventDefault(); action(); }
    },
  };
}

export function ExecutionProfilePicker({ catalog, selection, onSelect, onRefresh, onLoadMore, locked, details }: ExecutionProfilePickerProps) {
  const groupId = useId();
  const dialog = useProfileDialog();
  if (locked) return <FrozenConfiguration creation={locked.creation} pending={locked.reason === "receipt-pending"} details={details} />;
  const selected = selection.kind === "configured" ? selection.profile : null;
  const missing = selected && catalog.loaded && !catalog.profiles.some(profile => profile.reference.id === selected.reference.id && profile.reference.configDigest === selected.reference.configDigest && profile.reference.runnerId === selected.reference.runnerId);
  return <div className="ep-picker">
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="ep-trigger" aria-label={`Execution profile: ${selected?.configuration.model ?? "Runner default"}`}><span>{selected?.configuration.model ?? "Runner default"}</span><span className="ep-trigger-access">{selected?.configuration.access === "none" ? "No tools" : "Read-only"}</span><span aria-hidden="true">⌄</span></Button></DialogTrigger>
      <DialogContent className="ep-dialog" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <DialogTitle>Execution profile</DialogTitle>
        <DialogDescription>Choose a complete configured profile for a new conversation. The choice locks when creation is submitted.</DialogDescription>
        <div className="ep-directory-actions"><Button type="button" variant="outline" onClick={onRefresh} disabled={catalog.loading}>{catalog.loading ? "Loading profiles…" : "Refresh profiles"}</Button><span role="status">{catalog.loaded ? `${catalog.profiles.length} profiles loaded${catalog.nextCursor ? "; more available" : ""}` : "Directory not loaded"}</span></div>
        {catalog.error && <p role="alert" className="ep-error">{catalog.error}</p>}
        {catalog.stale && catalog.loaded && <p className="ep-notice">Directory is stale. Refresh before choosing a configured profile.</p>}
        {missing && <p className="ep-notice">Your selection is not in the loaded directory. It stays selected; the center will validate availability when you create.</p>}
        <fieldset className="ep-options" disabled={catalog.loading}>
          <legend className="sr-only">Configured execution profiles</legend>
          <label className="ep-option"><input type="radio" name={groupId} checked={!selected} onChange={() => onSelect(legacyDefaultSelection())} /><span><strong>Runner default</strong><span>Legacy compatibility · no pinned profile</span><small>Thinking disabled · configured read-only access</small></span></label>
          {catalog.profiles.map(profile => <label className="ep-option" key={profile.reference.id}>
            <input type="radio" name={groupId} checked={selected?.reference.id === profile.reference.id} disabled={catalog.stale || !isChatAccess(profile.configuration.access)} onChange={() => onSelect(configuredSelection(profile))} />
            <span><strong>{profile.model.displayName || profile.configuration.model}</strong><span>Requested model: {profile.configuration.model}</span><small>Runner {profile.reference.runnerId}</small><small>Profile {profile.reference.id}</small><span>{profile.configuration.access === "none" ? "No tools" : profile.configuration.access === "configured-readonly" ? "Configured read-only access" : `Access declaration: ${profile.configuration.access}`}{profile.configuration.requireReadApproval ? " · read approval required" : ""}</span>{!isChatAccess(profile.configuration.access) && <strong>Cannot be used for ordinary chat</strong>}<small>Thinking disabled · effort unsupported</small><small>Provider availability not checked · actual model unknown</small><details><summary>Configuration details</summary><span>Adapter {profile.configuration.adapterVersion}</span><span>Permission mode {profile.configuration.permissionMode}</span><span>Limits: {profile.configuration.limits.maxTurns} turns, ${profile.configuration.limits.maxBudgetUsd}, {profile.configuration.limits.timeoutMs / 1000}s</span><small>Configuration digest {profile.reference.configDigest}</small><small>Material scope digest {profile.configuration.materialScopeDigest}</small></details></span>
          </label>)}
        </fieldset>
        {!catalog.loading && catalog.loaded && !catalog.profiles.length && <p>No configured profiles were returned. Runner default remains an explicit compatibility choice.</p>}
        {catalog.nextCursor && <Button type="button" variant="outline" disabled={!catalog.canLoadMore} onClick={onLoadMore}>Load more profiles</Button>}
        <p className="ep-footnote">This is a paged directory, not a global model search. A profile declares configuration; it does not attest that a runner or provider is online.</p>
        {details?.(dialog.navigate)}
      </DialogContent>
    </Dialog>
  </div>;
}

function FrozenConfiguration({ creation, pending, details }: { creation: ConversationCreation; pending: boolean; details?: ExecutionProfilePickerProps["details"] }) {
  const dialog = useProfileDialog();
  const access = creation.requested.tools === "none" ? "No tools" : creation.requested.tools === "configured-readonly" ? "Read-only" : `Access: ${creation.requested.tools}`;
  return <section className="ep-locked" aria-label="Locked execution profile">
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="ep-trigger" aria-label={`Conversation settings: ${creation.requested.model}`}>
        <span>{creation.requested.model === "runner-default" ? "Runner default" : creation.requested.model}</span><span className="ep-trigger-access">{access}</span><span className="ep-trigger-lock">{pending ? "Receipt pending" : "Locked"}</span><span aria-hidden="true">⌄</span>
      </Button></DialogTrigger>
      <DialogContent className="ep-dialog ep-configuration-dialog" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <DialogTitle>Conversation settings</DialogTitle>
        <DialogDescription>{pending ? "Creation receipt pending. Retry keeps the same frozen configuration." : "This conversation’s requested configuration is locked. Start a new conversation to choose another profile."}</DialogDescription>
        <section className="ep-requested" aria-label="Requested configuration">
          <h3>Requested configuration</h3>
          <dl><dt>Model</dt><dd>{creation.requested.model}</dd><dt>Thinking</dt><dd>{creation.requested.thinking}</dd><dt>Access</dt><dd>{creation.requested.tools}</dd></dl>
          <details className="ep-identities"><summary>Profile identifiers</summary><dl><dt>Profile</dt><dd>{creation.executionProfile?.id ?? "Unpinned legacy default"}</dd>{creation.executionProfile && <><dt>Runner</dt><dd>{creation.executionProfile.runnerId}</dd><dt>Configuration digest</dt><dd>{creation.executionProfile.configDigest}</dd></>}</dl></details>
          <p className="ep-footnote">Requested configuration only. Actual settings and provider availability are unknown until execution reports them.</p>
        </section>
        {details?.(dialog.navigate)}
      </DialogContent>
    </Dialog>
  </section>;
}


/** A fresh, nonserialized Symbol for one host draft/view/authority lineage. Tuple equality is not ownership. */
export type MessageSettingsDraftOwnership = symbol;
export type MessageSettingsCommitResult = { status: "applied" | "stale" | "unavailable" | "unknown" };
export interface MessageSettingsDraftAuthority {
  ownership: MessageSettingsDraftOwnership;
  editable: boolean;
  catalog: MessageSettingsCatalogSnapshot;
  context: MessageSettingsContext;
}

/** The host invokes this on the actual commit stack, reading its live authority, never render-time props. */
export function commitMessageSettingsChange(
  value: Immutable<ClaudeTurnSettings> | undefined,
  expectedOwnership: MessageSettingsDraftOwnership,
  readCurrent: () => MessageSettingsDraftAuthority,
  write: (value: Immutable<ClaudeTurnSettings> | undefined) => void,
): MessageSettingsCommitResult {
  const current = readCurrent();
  if (current.ownership !== expectedOwnership) return { status: "stale" };
  if (!current.editable) return { status: "unavailable" };
  let frozen: Immutable<ClaudeTurnSettings> | undefined;
  try { frozen = captureMessageSettings(value, current.catalog, current.context); }
  catch { return { status: "unavailable" }; }
  // No await between the live comparison, public validation and the single host write. Omit also checks ownership.
  write(frozen);
  return { status: "applied" };
}

export interface MessageSettingsPickerProps {
  catalog: MessageSettingsCatalogSnapshot;
  context: MessageSettingsContext;
  value: Immutable<ClaudeTurnSettings> | undefined;
  draftOwnership: MessageSettingsDraftOwnership;
  editable: boolean;
  /** Synchronous host CAS, including for undefined. Must read live authority at commit, not its old render closure. */
  onChange(value: Immutable<ClaudeTurnSettings> | undefined, expectedOwnership: MessageSettingsDraftOwnership): MessageSettingsCommitResult;
  onRefresh(): void;
  onLoadMore(): void;
  details?: ExecutionProfilePickerProps["details"];
  /** Private P01 presentation only; the host still owns C and synchronous CAS. */
  hostControl?: { opening: symbol | null; close(): void; invoker(): HTMLElement | null };
}

type SettingsChoice = Immutable<ClaudeTurnSettings>;
type PendingSettings = { kind: "choice"; value: SettingsChoice } | { kind: "omit" } | null;
type QuickFilters = { model: string; thinking: string; effort: string; speed: string };
type SettingsOpening = ReturnType<typeof beginMessageSettingsEdit>;
const emptyFilters = (): QuickFilters => ({ model: "", thinking: "", effort: "", speed: "" });
const effortNames = { "not-requested": "不请求力度", low: "低", medium: "中", high: "高", xhigh: "更高", max: "最高" };
const effortKey = (choice: SettingsChoice) => choice.requested.effort.kind === "level" ? choice.requested.effort.value : "not-requested";
const authorityKey = (context: MessageSettingsContext) => JSON.stringify([context.profile, context.capability]);
const matchesFilters = (choice: SettingsChoice, filter: QuickFilters) =>
  (!filter.model || choice.requested.model === filter.model) && (!filter.thinking || choice.requested.thinking === filter.thinking) &&
  (!filter.effort || effortKey(choice) === filter.effort) && (!filter.speed || choice.requested.speed === filter.speed);

/** One ephemeral opening, shared by the actual Picker and lifetime regressions; never owns a draft. */
export function beginMessageSettingsEdit(readCurrent: () => Pick<MessageSettingsPickerProps, "draftOwnership" | "editable" | "value" | "catalog" | "context" | "onChange">) {
  const opening = readCurrent();
  const authority = authorityKey(opening.context);
  let active = true;
  function reconcile() {
    const current = readCurrent();
    if (current.draftOwnership !== opening.draftOwnership || !current.editable || authorityKey(current.context) !== authority || !sameMessageSettings(current.value, opening.value)) active = false;
    return active;
  }
  return {
    isActive: () => active,
    reconcile,
    close: () => { active = false; },
    apply(value: SettingsChoice | undefined): MessageSettingsCommitResult {
      if (!reconcile()) return { status: "stale" };
      active = false; // Reentrant/queued Apply and omit are revoked before invoking the host.
      const current = readCurrent();
      let frozen: SettingsChoice | undefined;
      try { frozen = captureMessageSettings(value, current.catalog, current.context); }
      catch { return { status: "unavailable" }; }
      // A host may throw after writing (for example a subscriber failure). Never claim its write did not happen.
      try { return current.onChange(frozen, opening.draftOwnership); }
      catch { return { status: "unknown" }; }
    },
    navigate(schedule: () => void) {
      if (!reconcile()) return false;
      active = false;
      schedule();
      return true;
    },
  };
}

/** Only local filters/candidate live here. The host remains the sole owner of the applied draft. */
export function MessageSettingsPicker(props: MessageSettingsPickerProps) {
  const { catalog, context, value, editable, onRefresh, onLoadMore, details, hostControl } = props;
  const groupId = useId(), noticeId = useId();
  const dialog = useProfileDialog();
  const [opening, setOpening] = useState<SettingsOpening | null>(null);
  const activeOpening = useRef<SettingsOpening | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [pending, setPending] = useState<PendingSettings>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const current = useRef(props);
  const notice = useRef<HTMLParagraphElement>(null);
  const focusedControl = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const suppressReturnFocus = useRef(false);
  const available = messageSettingsAvailability(catalog, context);
  const choices: SettingsChoice[] = available.allowed ? (available.profile.configuration.turnSettings?.choices ?? []).map(requested => ({
    protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: available.profile.reference, requested,
  })) : [];
  const visible = choices.filter(choice => matchesFilters(choice, filters));
  const pendingAvailable = pending?.kind === "omit" || (pending?.kind === "choice" && choices.some(choice => sameMessageSettings(choice, pending.value)));
  const missing = value !== undefined && catalog.loaded && !catalog.loading && !catalog.stale && !choices.some(choice => sameMessageSettings(value, choice));
  const canApply = editable && opening?.isActive() === true && pendingAvailable;

  function revoke() {
    activeOpening.current?.close();
    activeOpening.current = null;
  }
  function changeOpen(next: boolean) {
    revoke();
    focusedControl.current = null;
    if (next) {
      const live = current.current;
      const session = beginMessageSettingsEdit(() => current.current);
      activeOpening.current = session; setOpening(session); setFilters(emptyFilters()); setFeedback(null);
      setPending(live.value && choices.some(choice => sameMessageSettings(choice, live.value)) ? { kind: "choice", value: live.value } : null);
      suppressReturnFocus.current = false;
    } else { setOpening(null); setPending(null); }
    dialog.onOpenChange(next);
    if (!next) hostControl?.close();
  }
  useLayoutEffect(() => {
    if (hostControl?.opening) changeOpen(true);
    else if (hostControl && dialog.open) changeOpen(false);
  }, [hostControl?.opening]);
  useLayoutEffect(() => {
    current.current = props;
    const session = activeOpening.current;
    if (session && !session.reconcile()) {
      revoke(); setPending(null); setFeedback("草稿或编辑权限已变化，本次选择已失效；关闭后重新打开，当前草稿未被更改。");
      if (!editable) { suppressReturnFocus.current = true; setOpening(null); dialog.onOpenChange(false); hostControl?.close(); }
    }
    if (activeOpening.current && available.allowed && pending?.kind === "choice" && !pendingAvailable) {
      setPending(null); setFeedback("候选已不在当前目录中；请重新选择，当前草稿仍保留。");
    }
    const focused = focusedControl.current;
    if (dialog.open && focused && (!focused.isConnected || focused.matches(":disabled"))) {
      notice.current?.focus(); focusedControl.current = notice.current;
    }
  });
  useLayoutEffect(() => () => { revoke(); suppressReturnFocus.current = true; }, []);

  function apply(session: SettingsOpening | null, candidate: PendingSettings) {
    if (!session?.isActive() || activeOpening.current !== session || !candidate) return;
    const result = session.apply(candidate.kind === "omit" ? undefined : candidate.value);
    activeOpening.current = null;
    if (result.status === "applied") changeOpen(false);
    else { setPending(null); setFeedback(result.status === "unknown" ? "宿主提交结果未知；请核对当前草稿后重新打开，不会自动重试。" : result.status === "stale" ? "宿主草稿已更新，未应用旧选择；请关闭后重新打开。" : "候选或宿主权限当前不可用，未应用选择；请关闭后重新打开。"); notice.current?.focus(); }
  }
  function stage(next: PendingSettings) {
    if (!opening?.isActive() || activeOpening.current !== opening) return;
    setPending(next); setFeedback(null);
  }
  function filter(axis: keyof QuickFilters, next: string) {
    if (!opening?.isActive() || activeOpening.current !== opening) return;
    setFilters(previous => ({ ...previous, [axis]: next })); stage(null);
  }
  const summary = value ? `${value.requested.model} · ${describeMessageChoice(value.requested)}` : "不单独设置";
  const staleOpening = opening !== null && !opening.isActive();
  return <div className="ep-picker">
    <Dialog open={dialog.open} onOpenChange={changeOpen}>
      {!hostControl && <DialogTrigger asChild><Button ref={trigger} type="button" variant="outline" className="ep-trigger" disabled={!editable} aria-label={`消息设置：${summary}`}>
        <span>{value?.requested.model ?? "下一条消息设置"}</span><span className="ep-trigger-access">{value ? describeMessageChoice(value.requested) : "不单独设置"}</span><span aria-hidden="true">⌄</span>
      </Button></DialogTrigger>}
      <DialogContent className="ep-dialog ep-message-dialog" onFocusCapture={event => { if (event.target instanceof HTMLElement) focusedControl.current = event.target; }} onCloseAutoFocus={event => {
        if (hostControl) {
          event.preventDefault();
          const invoker = hostControl.invoker();
          if (!suppressReturnFocus.current && invoker?.isConnected && invoker.getClientRects().length && !invoker.matches(":disabled")) invoker.focus();
        }
        if (suppressReturnFocus.current || !trigger.current?.isConnected || trigger.current.disabled || trigger.current.offsetParent === null) event.preventDefault();
        dialog.onCloseAutoFocus(event);
      }}>
        <DialogTitle>下一条消息设置</DialogTitle>
        <DialogDescription>筛选当前会话可用的组合，选择后按“应用”。已发送和排队的消息保持原设置。</DialogDescription>
        <div className="ep-settings-body">
        <section className="ep-applied" aria-label="当前草稿已应用设置"><span className="ep-section-label">当前</span><strong className="ep-compact-model">{value?.requested.model ?? "不单独设置"}</strong>{value && <span className="ep-choice-description">{describeMessageChoice(value.requested)}</span>}</section>
        <p id={noticeId} ref={notice} tabIndex={-1} role="status" className="ep-notice">{feedback ?? (!editable ? "宿主当前不可编辑。" : !available.allowed ? available.reason : pending?.kind === "choice" && !pendingAvailable ? "候选已不在当前目录中；请重新选择，当前草稿仍保留。" : "仅按应用后更新当前草稿。")}</p>
        <div className="ep-directory-actions"><Button type="button" variant="outline" onClick={onRefresh} disabled={catalog.loading}>{catalog.loading ? "正在加载…" : "刷新设置目录"}</Button><span>{catalog.loaded ? `已加载 ${catalog.profiles.length} 项配置${catalog.nextCursor ? "，还有更多" : ""}` : "尚未加载目录"}</span></div>
        {catalog.error && <p role="alert" className="ep-error">{catalog.error}</p>}
        {missing && <p className="ep-notice">原选择不在当前可用目录中，仍保留原值；请加载更多或刷新后核对。</p>}
        <fieldset className="ep-filters" disabled={staleOpening || !editable || !available.allowed}>
          <legend className="sr-only">快速筛选</legend>
          <div className="ep-model-filter">
            <QuickFacet label="模型" value={filters.model} onChange={next => filter("model", next)} options={[...new Set(choices.map(choice => choice.requested.model))].map<[string, string]>(model => [model, model])} />
          </div>
          <details className="ep-extra-filters"><summary>更多筛选<span className="ep-filter-description">思考 · 力度 · 速度</span></summary><div className="ep-facet-grid">
            <QuickFacet label="思考" value={filters.thinking} onChange={next => filter("thinking", next)} options={[...new Set(choices.map(choice => choice.requested.thinking))].map<[string, string]>(thinking => [thinking, thinking === "adaptive" ? "自适应思考" : "关闭思考"])} />
            <QuickFacet label="力度" value={filters.effort} onChange={next => filter("effort", next)} options={[...new Set(choices.map(effortKey))].map<[string, string]>(effort => [effort, effortNames[effort]])} />
            <QuickFacet label="速度" value={filters.speed} onChange={next => filter("speed", next)} options={[...new Set(choices.map(choice => choice.requested.speed))].map<[string, string]>(speed => [speed, speed === "fast" ? "快速请求" : "标准速度"])} />
          </div></details>
        </fieldset>
        <Button type="button" className="ep-clear-filters" variant="ghost" disabled={staleOpening} onClick={() => { if (opening?.isActive() && activeOpening.current === opening) { setFilters(emptyFilters()); stage(null); } }}>清除筛选</Button>
        <fieldset className="ep-options" disabled={staleOpening || !editable}>
          <legend>完整消息设置组合</legend>
          <label className="ep-option"><input type="radio" name={groupId} checked={pending?.kind === "omit"} onChange={() => stage({ kind: "omit" })} /><span><strong>不单独设置</strong><small>应用后省略本次设置请求</small></span></label>
          {visible.map(choice => <label className="ep-option" key={claudeTurnSettingsJson(choice)}>
            <input type="radio" name={groupId} checked={pending?.kind === "choice" && sameMessageSettings(pending.value, choice)} onChange={() => stage({ kind: "choice", value: choice })} />
            <span><strong className="ep-compact-model">{choice.requested.model}</strong><span>{describeMessageChoice(choice.requested)}</span>{choice.requested.model.length > 48 && <details><summary>完整模型名称<span className="ep-identity-suffix"> · …{choice.requested.model.slice(-16)}</span></summary><span>{choice.requested.model}</span></details>}</span>
          </label>)}
        </fieldset>
        {available.allowed && visible.length === 0 && <p role="status">没有匹配的已声明组合；清除筛选或调整条件，不会自动替换其他设置。</p>}
        {catalog.loaded && !catalog.loading && choices.length === 0 && <p>当前目录没有可选组合，不会自动生成默认设置。</p>}

        {catalog.nextCursor && <Button type="button" variant="outline" disabled={!catalog.canLoadMore} onClick={onLoadMore}>加载更多设置</Button>}
        <details className="ep-identities"><summary>配置详情</summary><p>只展示当前授权配置的完整组合。这里是请求意图，实际设置与模型可用性须由执行结果确认。</p><p>不单独设置只省略本次请求，不代表重置或继承上一条设置。</p>{value && <><p>当前完整模型：{value.requested.model}</p><p>当前配置 {value.profile.id} · Runner {value.profile.runnerId} · 摘要 {value.profile.configDigest}</p></>}{pending?.kind === "choice" && <p>待应用完整模型：{pending.value.requested.model} · {describeMessageChoice(pending.value.requested)}</p>}{details?.(action => {
          if (!opening || activeOpening.current !== opening) return;
          opening.navigate(() => { activeOpening.current = null; setPending(null); dialog.navigate(action); });
        })}</details>
        </div>
        <div className="ep-settings-footer"><section className="ep-pending" aria-label="待应用选择"><span className="ep-section-label">待应用</span><span className="ep-compact-model">{pending?.kind === "choice" ? `${pending.value.requested.model} · ${describeMessageChoice(pending.value.requested)}` : pending?.kind === "omit" ? "不单独设置" : "尚未选择，不会更改草稿"}</span></section><div className="ep-settings-actions"><Button type="button" aria-describedby={noticeId} disabled={!canApply} onClick={() => apply(opening, pending)}>应用</Button><Button type="button" variant="outline" onClick={() => changeOpen(false)}>取消</Button></div></div>
      </DialogContent>
    </Dialog>
  </div>;
}

function QuickFacet({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange(value: string): void }) {
  return <label className="ep-facet">{label}<select value={value} onChange={event => onChange(event.target.value)}><option value="">全部{label}</option>{value && !options.some(([key]) => key === value) && <option value={value}>已不可用：{value}</option>}{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function describeMessageChoice(choice: Immutable<ClaudeTurnSettings["requested"]>): string {
  const effort = choice.effort.kind === "level" ? `力度${effortNames[choice.effort.value]}` : "不请求力度";
  return `${choice.thinking === "adaptive" ? "自适应思考" : "关闭思考"} · ${effort} · ${choice.speed === "fast" ? "快速请求" : "标准速度"}`;
}

/** Each renderer receives its own public frozen snapshot, never the live composer C. */
export function MessageSettingsSummary({ value, label }: { value: Immutable<ClaudeTurnSettings> | undefined; label: string }) {
  return <details className="ep-settings-summary"><summary><span>{label}</span><span className="ep-settings-preview">{value ? `${value.requested.model} · ${describeMessageChoice(value.requested)}` : "not attached"}</span></summary>
    {value ? <><p>{value.requested.model}</p><p>{describeMessageChoice(value.requested)}</p><p>Profile {value.profile.id} · Runner {value.profile.runnerId} · Digest {value.profile.configDigest}</p><p>Requested only; observed execution may differ or be unavailable.</p></> : <p>No per-message settings were requested. This does not request a reset or infer inherited execution settings.</p>}
  </details>;
}
