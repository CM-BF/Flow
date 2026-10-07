import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { FlowClient } from "@flow/client";
import { CLAUDE_TURN_SETTINGS_PROTOCOL, type ClaudeTurnSettings, type ConversationCreation } from "@flow/contracts";
import { createMessageSettingsCatalog, type MessageSettingsCatalogSnapshot } from "../src/execution-profiles/catalog";
import { ExecutionProfilePicker, MessageSettingsPicker } from "../src/execution-profiles/ExecutionProfilePicker";
import { captureMessageSettings, legacyDefaultSelection, type Immutable, type MessageSettingsContext } from "../src/execution-profiles/selection";
import { Button } from "../src/components/ui/button";
import { applyTheme } from "../src/themes";
import "../src/assistant-ui.css";
import "../src/styles.css";

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const reference = { id: id(1), runnerId: id(101), configDigest: "a".repeat(64) };
const legacyCatalog = { profiles: [], nextCursor: null, loading: false, loaded: false, stale: true, error: null, canLoadMore: false };
const creation: ConversationCreation = { title: "Existing fixture conversation", harness: "claude", requested: { model: "creation-base", thinking: "disabled", tools: "none" } };

function Pane({ name, catalog, context, refresh, loadMore }: { name: string; catalog: MessageSettingsCatalogSnapshot; context: MessageSettingsContext; refresh(): void; loadMore(): void }) {
  const [value, setValue] = useState<Immutable<ClaudeTurnSettings>>();
  const [sent, setSent] = useState<Immutable<ClaudeTurnSettings>>();
  const [queued, setQueued] = useState<Immutable<ClaudeTurnSettings>>();
  const [draft, setDraft] = useState("未发送的草稿");
  const [error, setError] = useState<string | null>(null);
  const target = useRef<HTMLButtonElement>(null);
  const [navigated, setNavigated] = useState(false);
  function capture(destination: "sent" | "queued") {
    try {
      const frozen = captureMessageSettings(value, catalog, context);
      if (destination === "sent") setSent(frozen); else setQueued(frozen);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Capture failed"); }
  }
  return <section aria-label={`Pane ${name}`} style={{ minWidth: 0, padding: "1rem", border: "1px solid var(--border)", borderRadius: ".75rem" }}>
    <h2>草稿 {name}</h2>
    <MessageSettingsPicker catalog={catalog} context={context} value={value} onChange={setValue} onRefresh={refresh} onLoadMore={loadMore}
      details={navigate => <Button variant="outline" onClick={() => navigate(() => { setNavigated(true); target.current?.focus(); })}>宿主详情操作</Button>} />
    <label style={{ display: "grid", marginTop: "1rem" }}>草稿文字<textarea aria-label={`Draft ${name}`} value={draft} onChange={event => setDraft(event.target.value)} style={{ minWidth: 0, background: "var(--background)", border: "1px solid var(--border)" }} /></label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".75rem" }}>
      <Button variant="outline" onClick={() => capture("sent")}>冻结 A 样本</Button><Button variant="outline" onClick={() => capture("queued")}>冻结 B 样本</Button>
      <Button ref={target} variant="ghost">宿主焦点目标</Button>
    </div>
    {error && <p role="alert">{error}</p>}
    <p data-testid={`navigation-${name}`}>{navigated ? "已由宿主导航" : "未导航"}</p>
    <details><summary>Fixture 本地快照（没有发送请求）</summary>
      {[["current", value], ["sent", sent], ["queued", queued]].map(([kind, snapshot]) => <output key={String(kind)} data-testid={`${name}-${kind}`} style={{ display: "block", overflowWrap: "anywhere" }}>{snapshot === undefined ? "omitted" : JSON.stringify(snapshot)}</output>)}
    </details>
  </section>;
}
function Connection({ epoch }: { epoch: number }) {
  const [catalog] = useState(() => {
    const client = new FlowClient({ baseUrl: `${location.origin}/connection-${epoch}`, token: "fixture-only" });
    return createMessageSettingsCatalog((options, signal) => client.claudeMessageSettingsProfiles(options, signal));
  });
  const snapshot = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const [advertised, setAdvertised] = useState(true);
  useEffect(() => () => catalog.dispose(), [catalog]);
  const context: MessageSettingsContext = { profile: reference, capability: advertised ? { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, choices: "execution-profile" } : null };
  return <>
    <Button variant="outline" onClick={() => setAdvertised(value => !value)}>{advertised ? "撤销设置能力" : "恢复设置能力"}</Button>
    <p data-testid="catalog-state">{snapshot.loading ? "loading" : snapshot.stale ? "stale" : "current"}; {snapshot.profiles.length} profiles; connection {epoch}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,22rem),1fr))", gap: "1rem" }}>
      {["left", "right"].map(name => <Pane key={name} name={name} catalog={snapshot} context={context} refresh={() => { void catalog.refresh(); }} loadMore={() => { void catalog.loadMore(); }} />)}
    </div>
  </>;
}
function Fixture() {
  const [epoch, setEpoch] = useState(1);
  return <main style={{ padding: "1rem", maxWidth: "65rem", margin: "0 auto" }}>
    <h1>下一条消息设置</h1><p>独立受控选择控件。配置意图、已冻结样本和当前草稿分开；未接入实际发送或排队。</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}><Button variant="ghost" onClick={() => applyTheme("light")}>Light</Button><Button variant="ghost" onClick={() => applyTheme("dark")}>Dark</Button><Button variant="outline" onClick={() => setEpoch(value => value + 1)}>新连接</Button></div>
    <Connection key={epoch} epoch={epoch} />
    <section aria-label="Legacy fixture"><h2>既有会话创建配置</h2><ExecutionProfilePicker catalog={legacyCatalog} selection={legacyDefaultSelection()} onSelect={() => {}} onRefresh={() => {}} onLoadMore={() => {}} locked={{ creation, reason: "created" }} /></section>
  </main>;
}
applyTheme("light");
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture mount");
createRoot(root).render(<Fixture />);
