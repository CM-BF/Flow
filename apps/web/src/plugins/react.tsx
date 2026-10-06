import {
  Component,
  Activity,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { PluginHost } from "./host";
import type { ContributionView, ResourceContext, SlotId } from "./types";
import { validateSlot, validateContext } from "./validation";
import "./react.css";

export function ExtensionSlot({
  host,
  slot,
  context,
  className,
}: {
  host: PluginHost;
  slot: SlotId;
  context: ResourceContext;
  className?: string;
}) {
  const contributions = useSyncExternalStore(
    (listener) => host.subscribeSlot(slot, listener),
    () => host.getSlotSnapshot(slot),
  );
  const [error, setError] = useState<string>();
  try {
    validateSlot(slot, context);
  } catch {
    return <span role="alert">Extension context unavailable</span>;
  }
  const execute = async (item: ContributionView) => {
    const declaration = item.declaration;
    if (declaration.kind === "panel") return;
    setError(undefined);
    const result = await host.execute(
      declaration.commandId,
      declaration.args,
      context,
    );
    if (!result.ok) setError(result.error);
  };
  return (
    <div className={className} data-plugin-slot={slot}>
      {contributions
        .filter((item) => item.declaration.kind === "button")
        .map((item) => (
          <button
            type="button"
            key={item.declaration.id}
            onClick={() => {
              void execute(item);
            }}
          >
            {item.declaration.title}
          </button>
        ))}
      <ContributionMenu
        items={contributions.filter((item) => item.declaration.kind === "menu")}
        onSelect={execute}
      />
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
function ContributionMenu({
  items,
  onSelect,
}: {
  items: readonly ContributionView[];
  onSelect: (item: ContributionView) => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focus = (index: number) =>
    menu.current
      ?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      [index]?.focus();
  useEffect(() => {
    if (open) focus(0);
  }, [open]);
  if (!items.length) return null;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <span
      className="plugin-action-menu"
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        type="button"
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        More actions
      </button>
      {open && (
        <div id={id} role="menu" aria-label="Extension actions" ref={menu}>
          {items.map((item, index) => (
            <button
              key={item.declaration.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                void onSelect(item);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                } else if (event.key === "Tab") close();
                else {
                  const target =
                    event.key === "ArrowDown"
                      ? (index + 1) % items.length
                      : event.key === "ArrowUp"
                        ? (index - 1 + items.length) % items.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? items.length - 1
                            : undefined;
                  if (target !== undefined) {
                    event.preventDefault();
                    focus(target);
                  }
                }
              }}
            >
              {item.declaration.title}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

class RenderBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void; onRetry: () => void },
  { error?: Error }
> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? (
      <div role="alert">
        Extension could not render.{" "}
        <button type="button" onClick={this.props.onRetry}>
          Retry extension
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function PluginView({
  host,
  contributionId,
  context,
  className,
  fallback,
}: {
  host: PluginHost;
  contributionId: string;
  context: ResourceContext;
  className?: string;
  fallback?: ReactNode;
}) {
  const registry = useSyncExternalStore(host.subscribe, host.list);
  const contribution = host.findContribution(contributionId);
  const contextKey = JSON.stringify(
    context.kind === "workspace"
      ? { kind: context.kind, taskId: context.taskId }
      : context,
  );
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    error?: string;
    ready?: boolean;
  }>({ key: "" });
  const key = `${contributionId}:${contextKey}:${attempt}`;
  useEffect(() => {
    let current = true;
    setResult({ key });
    void host.show(contributionId, context).then((outcome) => {
      if (current)
        setResult(
          outcome.ok ? { key, ready: true } : { key, error: outcome.error },
        );
    });
    return () => {
      current = false;
    };
  }, [host, key]);
  const retry = () => setAttempt((value) => value + 1);
  if (!contribution) return fallback ?? null;
  // Keep the renderer instance across resource changes; hide it until that resource is authorized.
  // Activity preserves local layout while pausing effects in a hidden panel.
  void registry;
  const Renderer = host.getRenderer(contributionId);
  const permission = Renderer
    ? host.checkView(contributionId, context)
    : undefined;
  const loading = result.key !== key || (!result.ready && !result.error);
  const error = result.key === key ? result.error : undefined;
  const denied = permission && !permission.ok ? permission.error : undefined;
  const visible = !loading && !error && !denied && Boolean(Renderer);
  return (
    <>
      {loading && (
        <div className={className} role="status">
          Loading extension…
        </div>
      )}
      {!loading && (error || denied) && (
        <div className={className} role="alert">
          {error ?? denied}{" "}
          <button type="button" onClick={retry}>
            Retry extension
          </button>
        </div>
      )}
      {Renderer && !denied && (
        <Activity mode={visible ? "visible" : "hidden"}>
          <RenderBoundary
            key={`${contributionId}:${attempt}`}
            onError={(error) =>
              host.reportRenderError(contribution.pluginId, error)
            }
            onRetry={retry}
          >
            <div className={className}>
              <Renderer
                context={validateContext(context)}
                execute={host.bind(contributionId, context)}
              />
            </div>
          </RenderBoundary>
        </Activity>
      )}
      {!Renderer &&
        !loading &&
        !error &&
        (fallback ?? <div role="status">Extension unavailable</div>)}
    </>
  );
}

export function PluginTabs({
  host,
  slot = "workspace.tabs",
  context,
  onClose,
}: {
  host: PluginHost;
  slot?: "workspace.tabs";
  context: ResourceContext;
  onClose?: () => void;
}) {
  const items = useSyncExternalStore(
    (listener) => host.subscribeSlot(slot, listener),
    () => host.getSlotSnapshot(slot),
  ).filter(
    (item): item is ContributionView => item.declaration.kind === "panel",
  );
  const [selected, setSelected] = useState<string>();
  const active = items.some((item) => item.declaration.id === selected)
    ? selected
    : items[0]?.declaration.id;
  const [visited, setVisited] = useState<ReadonlySet<string>>(
    () => new Set(active ? [active] : []),
  );
  const itemIds = items.map((item) => item.declaration.id).join("|");
  useEffect(() => {
    setVisited((previous) => {
      const next = new Set(
        [...previous].filter((id) =>
          items.some((item) => item.declaration.id === id),
        ),
      );
      if (active) next.add(active);
      return next.size === previous.size &&
        [...next].every((id) => previous.has(id))
        ? previous
        : next;
    });
  }, [active, itemIds]);
  const tabs = useRef<HTMLDivElement>(null);
  const focusedId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      focusedId.current &&
      !items.some((item) => item.declaration.id === focusedId.current)
    ) {
      const next = tabs.current?.querySelector<HTMLButtonElement>(
        '[aria-selected="true"]',
      );
      next?.focus();
      focusedId.current = next?.dataset.id;
    }
  }, [items.map((item) => item.declaration.id).join("|")]);
  const select = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      tabs.current
        ?.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)
        ?.focus();
    });
  };
  return (
    <section aria-label="Extensions">
      <div role="tablist" aria-label="Extension panels" ref={tabs}>
        {items.map((item, index) => (
          <button
            type="button"
            key={item.declaration.id}
            data-id={item.declaration.id}
            id={`tab-${item.declaration.id}`}
            role="tab"
            tabIndex={active === item.declaration.id ? 0 : -1}
            aria-selected={active === item.declaration.id}
            aria-controls={`panel-${item.declaration.id}`}
            onFocus={() => {
              focusedId.current = item.declaration.id;
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !tabs.current?.contains(event.relatedTarget as Node)
              )
                focusedId.current = undefined;
            }}
            onClick={() => setSelected(item.declaration.id)}
            onKeyDown={(event) => {
              let target: number | undefined;
              if (event.key === "ArrowRight")
                target = (index + 1) % items.length;
              if (event.key === "ArrowLeft")
                target = (index - 1 + items.length) % items.length;
              if (event.key === "Home") target = 0;
              if (event.key === "End") target = items.length - 1;
              if (target !== undefined) {
                event.preventDefault();
                select(items[target]!.declaration.id);
              }
            }}
          >
            {item.declaration.title}
          </button>
        ))}
        {onClose && (
          <button type="button" onClick={onClose}>
            Close extensions
          </button>
        )}
      </div>
      {items
        .filter((item) => visited.has(item.declaration.id))
        .map((item) => (
          <Activity
            key={item.declaration.id}
            mode={active === item.declaration.id ? "visible" : "hidden"}
          >
            <div
              role="tabpanel"
              id={`panel-${item.declaration.id}`}
              aria-labelledby={`tab-${item.declaration.id}`}
            >
              <PluginView
                host={host}
                contributionId={item.declaration.id}
                context={context}
              />
            </div>
          </Activity>
        ))}
    </section>
  );
}
