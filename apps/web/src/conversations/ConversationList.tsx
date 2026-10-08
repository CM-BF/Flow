import { useSyncExternalStore, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { ConversationCatalog } from "./projection";
export function ConversationList({ catalog, selectedId, query, onSelect, renderActions }: { catalog: ConversationCatalog; selectedId?: string; query: string; onSelect: (id: string) => void; renderActions?: (id: string) => ReactNode }) {
  const state = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  return <>
    <div className="flow-section-label"><span>Chats</span><button className="flow-icon" aria-label="Refresh conversations" onClick={() => void catalog.refresh()}><RefreshCw size={13} /></button></div>
    {state.loading && <p className="flow-list-notice" role="status">Loading conversations…</p>}
    {state.error && <p className="flow-list-notice" role="alert">{state.error} <button className="flow-link" onClick={() => void catalog.refresh()}>Retry conversations</button></p>}
    <nav className="flow-chat-list" aria-label="Conversations">{state.items.filter(item => item.title.toLowerCase().includes(query.toLowerCase())).map(item =>
      <div key={item.id} className={`flow-chat-row ${selectedId === item.id ? "selected" : ""}`}><button title={item.title} className={selectedId === item.id ? "selected" : ""} onClick={() => onSelect(item.id)}><span>{item.title}</span></button>{renderActions?.(item.id)}</div>)}</nav>
    {state.nextCursor && <button className="flow-link" onClick={() => void catalog.refresh(true)} disabled={state.loading}>More conversations</button>}
  </>;
}
