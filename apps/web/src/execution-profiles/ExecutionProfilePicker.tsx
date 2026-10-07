import { useId, useRef, useState, type ReactNode } from "react";
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


export interface MessageSettingsPickerProps {
  catalog: MessageSettingsCatalogSnapshot;
  context: MessageSettingsContext;
  value: Immutable<ClaudeTurnSettings> | undefined;
  onChange(value: Immutable<ClaudeTurnSettings> | undefined): void;
  onRefresh(): void;
  onLoadMore(): void;
  details?: ExecutionProfilePickerProps["details"];
}

/** Controlled next-message intent. Frozen sent/queued settings belong to their receipt owners. */
export function MessageSettingsPicker({ catalog, context, value, onChange, onRefresh, onLoadMore, details }: MessageSettingsPickerProps) {
  const groupId = useId();
  const dialog = useProfileDialog();
  const available = messageSettingsAvailability(catalog, context);
  const choices = catalog.profiles.flatMap(profile => (profile.configuration.turnSettings?.choices ?? []).map((requested): Immutable<ClaudeTurnSettings> => ({
    protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: profile.reference, requested,
  })));
  const missing = value !== undefined && catalog.loaded && !choices.some(choice => sameMessageSettings(value, choice));
  return <div className="ep-picker">
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="ep-trigger" aria-label={`消息设置：${value?.requested.model ?? "不附加设置"}`}>
        <span>{value?.requested.model ?? "下一条消息设置"}</span><span className="ep-trigger-access">{value ? describeMessageChoice(value.requested) : "不附加"}</span><span aria-hidden="true">⌄</span>
      </Button></DialogTrigger>
      <DialogContent className="ep-dialog" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <DialogTitle>下一条消息设置</DialogTitle>
        <DialogDescription>选择一个已配置的完整组合。仅影响下一次提交，已发送或排队的消息保持原设置。</DialogDescription>
        <div className="ep-directory-actions">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={catalog.loading}>{catalog.loading ? "正在加载…" : "刷新设置目录"}</Button>
          <span role="status">{catalog.loaded ? `已加载 ${catalog.profiles.length} 项配置${catalog.nextCursor ? "，还有更多" : ""}` : "尚未加载目录"}</span>
        </div>
        {catalog.error && <p role="alert" className="ep-error">{catalog.error}</p>}
        {!available.allowed && <p className="ep-notice">{available.reason}</p>}
        {missing && <p className="ep-notice">原选择不在已加载目录中，仍保留原值；请加载更多或刷新后核对。</p>}
        {value && <section aria-label="当前草稿设置" className="ep-requested" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <strong>{value.requested.model}</strong><p>{describeMessageChoice(value.requested)}</p>
          <details className="ep-identities"><summary>选择身份</summary><p className="ep-footnote" style={{ overflowWrap: "anywhere" }}>配置 {value.profile.id} · Runner {value.profile.runnerId} · {value.profile.configDigest}</p></details>
        </section>}
        <fieldset className="ep-options">
          <legend className="sr-only">完整消息设置组合</legend>
          <label className="ep-option"><input type="radio" name={groupId} checked={value === undefined} onChange={() => onChange(undefined)} /><span><strong>不附加消息设置</strong><small>省略本次设置请求，不代表重置或继承上一条设置。</small></span></label>
          {choices.map(choice => {
            const same = available.allowed && choice.profile.id === available.profile.reference.id && choice.profile.runnerId === available.profile.reference.runnerId && choice.profile.configDigest === available.profile.reference.configDigest;
            return <label className="ep-option" key={claudeTurnSettingsJson(choice)}>
              <input type="radio" name={groupId} checked={sameMessageSettings(value, choice)} disabled={!same} onChange={() => onChange(captureMessageSettings(choice, catalog, context))} />
              <span><strong>{choice.requested.model}</strong><span>{describeMessageChoice(choice.requested)}</span>{!same && <small>当前会话不可选择此组合</small>}<details><summary>配置身份</summary><small>配置 {choice.profile.id}</small><small>Runner {choice.profile.runnerId}</small><small>摘要 {choice.profile.configDigest}</small></details></span>
            </label>;
          })}
        </fieldset>
        {catalog.loaded && choices.length === 0 && <p>目录没有可选组合，不会自动生成默认设置。</p>}
        {catalog.nextCursor && <Button type="button" variant="outline" disabled={!catalog.canLoadMore} onClick={onLoadMore}>加载更多设置</Button>}
        <p className="ep-footnote">这里展示配置意图，不代表账号权限、模型可用性或实际执行结果。提交时仍由中心验证。</p>
        {details?.(dialog.navigate)}
      </DialogContent>
    </Dialog>
  </div>;
}

function describeMessageChoice(choice: Immutable<ClaudeTurnSettings["requested"]>): string {
  const levels = { low: "低", medium: "中", high: "高", xhigh: "更高", max: "最高" };
  const effort = choice.effort.kind === "level" ? `力度${levels[choice.effort.value]}` : "不请求力度";
  return `${choice.thinking === "adaptive" ? "自适应思考" : "关闭思考"} · ${effort} · ${choice.speed === "fast" ? "快速请求" : "标准速度"}`;
}
