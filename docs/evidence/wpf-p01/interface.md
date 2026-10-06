# WPF-P01 typed host interface v1

Status: frozen v1 with M02, 2026-10-06. CommandContext.execute was finalized as Promise<void> (throw on failure); public PluginHost.execute alone returns OperationResult. Actual types are authoritative. Module exports from `apps/web/src/plugins/index.ts`; React bindings from `apps/web/src/plugins/react.tsx`; built-in definitions from `apps/web/src/plugins/builtins.ts`. This is a trusted in-process interface, not a public center protocol or third-party isolation system.

## App-owned ports

```ts
type WorkspaceTabId = 'files'|'terminal'|`detail:${string}`;
type ResourceContext =
  | { kind:'global' }
  | { kind:'task'; taskId:string }
  | { kind:'message'; taskId:string; messageId:string; role:'user'|'assistant' }
  | { kind:'composer'; viewId:string; isDraft:boolean }
  | { kind:'workspace'; taskId:string|null; tabId:WorkspaceTabId }
  | { kind:'reference'; taskId:string; referenceId:string };
interface NavigationSnapshot { activeTaskId: string | null; workspaceTab: WorkspaceTabId; workspaceOpen: boolean }
interface ThemeDefinition { id: string; label: string; scheme: 'light'|'dark'; tokens: Readonly<Record<string,string>> }
interface ThemeSnapshot { themeId: string; scheme: 'light'|'dark'; availableThemes: readonly ThemeDefinition[] }
interface Readable<T> { getSnapshot(): T; subscribe(listener:()=>void): ()=>void }
interface HostCommandArgs {
  'flow.chat.open': { taskId: string };
  'flow.workspace.open': { taskId: string; tab: WorkspaceTabId };
  'flow.workspace.close': Record<string,never>;
  'flow.reference.load': { taskId: string; referenceId: string };
  'flow.theme.set': { themeId: string };
  'flow.composer.insertText': { viewId: string; text: string };
  'flow.clipboard.copy': { text: string };
}
type Capability = 'ui.navigate'|'ui.layout'|'reference.read'|'theme.write'|'theme.register'|'workspace.read'|'composer.write'|'clipboard.write';
interface HostPort {
  navigation: Readable<Readonly<NavigationSnapshot>>;
  theme: Readable<Readonly<ThemeSnapshot>>;
  getContext(): Readonly<ResourceContext>;
  authorize(pluginId:string, capability:Capability, context:Readonly<ResourceContext>): boolean;
  execute<K extends keyof HostCommandArgs>(command:K, args:HostCommandArgs[K], meta:{pluginId:string;context:Readonly<ResourceContext>;signal:AbortSignal;theme?:ThemeDefinition}): Promise<void>;
}
```

M02/App retains FlowClient, token, catalog/projection and all task commands. App must validate task/reference IDs against its current authoritative projection before executing the bridge. Context never contains credentials or whole connection/composer forms. Host binds plugin identity and rechecks declared capability plus `authorize` at execution, including after async activation; callers cannot pass a forged plugin ID. The optional resolved theme descriptor is supplied by host only for a validated contributed theme; App can apply its allowed semantic tokens without changing themes.ts. Disable of an active contributed theme calls the same bridge with built-in light/dark fallback.

Theme and navigation snapshots must retain identity when unchanged. Their independent subscriptions are never combined with token/message updates or the plugin registry store. HostPort.execute is an App callback returning Promise<void> and may throw. Public PluginHost.execute returns explicit `{ok:true,value?}|{ok:false,error}`; CommandContext.execute is Promise<void> and throws on bridge denial/failure; handlers may explicitly catch for a documented fallback. An uncaught bridge failure reaches the public boundary as top-level ok:false, never nested inside ok:true. Public host.execute catches activation/bridge/parser/event failures with plugin attribution, so callers never infer that the bridge itself returns OperationResult.

## Definitions, lifecycle and contributions

```ts
interface PluginDefinition { manifest: PluginManifest; load(signal:AbortSignal):Promise<PluginModule> }
interface PluginModule { activate(context:PluginContext): void|Disposable|Promise<void|Disposable> }
interface Disposable { dispose():void }
// Manifest is JSON data: id/version/hostApi:1/capabilities/activationEvents,
// command declarations and contributions. No callbacks or arbitrary import URLs.
interface PluginHost {
  register(definition:PluginDefinition):Disposable;
  activate(pluginId:string):Promise<OperationResult>;
  deactivate(pluginId:string):Promise<OperationResult>;
  dispose():Promise<void>; // invalidates every generation; App creates a new host for a new connection
  list():readonly PluginSummary[];
  execute(commandId:string,args?:unknown,invocation?:ResourceContext):Promise<OperationResult>; // trusted App/UI entry only
  getThemes():readonly ThemeDefinition[];
  getSlotSnapshot(slot:SlotId):readonly ContributionView[];
  subscribeSlot(slot:SlotId,listener:()=>void):()=>void;
}
```

Registered manifest IDs reserve globally namespaced commands/contributions atomically. Module activation registers declared command handlers (`parse(unknown)` plus `run(validated, context)`) and panel/settings/renderer implementations; static button/menu declarations reference those command IDs. Themes are declarative contributions. All activated registrations are staged and published once only on successful current-generation activation. `context.own(disposable)` covers subscriptions/listeners/timers. Deactivation disables dispatch first, aborts and invalidates generation, removes contributions, then attempts all disposals in reverse order even if one fails. Concurrent activate shares one pending load, while concurrent execute retains distinct valid user requests. Late results dispose rather than publish. Explicit activate retries/re-enables; merely displaying a slot does not revive a disabled plugin.

`PluginContext` exposes scoped `command`, `contribute`, `own`, `signal` and narrow navigation/theme reads/subscriptions. Each registered command handler receives a fresh CommandContext with its validated immutable invocation context and typed bridge execution. Activation context itself does not gain an unbound privileged bridge. A rendered plugin view receives only a bound command invocation closure; it does not receive root PluginHost.execute or a context override parameter. It never exposes the host registry mutator, FlowClient or a caller-controlled identity. Captured context checks generation on every read/registration/dispatch. Activation and commands catch their own errors; React boundaries only handle render/lifecycle exceptions.

## Stable semantic slots and React bindings

`SlotId`: `activityBar.primary`, `activityBar.bottom`, `sidebar.header`, `sidebar.item.actions`, `sidebar.footer`, `chat.header`, `chat.task.actions`, `chat.message.actions`, `chat.composer.actions`, `workspace.header`, `workspace.tabs`, `workspace.actions`, `artifact.actions`, `settings.sections`.

- `ExtensionSlot({host, slot, context, className?})`: declarative action/menu contributions, explicit activation by command; typed context belongs to this semantic location, never read by DOM selector.
- `PluginView({host, contributionId, context, className?, fallback?})`: activates a declared panel on first visible use, local loading/error/retry and render boundary. Disposal removes only that contribution; App owns surrounding native tab selection/focus.
- `PluginTabs({host, slot:'workspace.tabs', context, onClose?})`: optional standalone fixture/integration convenience with keyboard roving tabs, stable contribution IDs and focus fallback when active plugin disappears. M02 may instead use its existing native tab host with `getSlotSnapshot` and `PluginView`.
- `ThemeDefinition` contributions form the theme registry; there is no theme DOM injection slot. Semantic color token keys are validated against the official current palette, not arbitrary CSS properties.

Context discriminates task/message/composer/reference identity. `chat.message.actions` is mounted at the real official message action bar; task cancel belongs to `chat.task.actions`. Sidebar item actions receive their item task ID, not the whole list. No existing data attribute is treated as an executable slot.

## Real built-in adapters

`createBuiltinPlugins({workspace})` returns ordinary PluginDefinitions to register. `workspace` is a private read-only `Readable<WorkspaceDisplay>` used only by the fixed trusted workspace module; `WorkspaceDisplay` contains current `task`, `details`, `connection` from the existing WorkspacePanels props, with no callbacks/client/token. The adapter renders the actual existing `WorkspacePanels`, composing its callbacks through typed host commands `flow.reference.load`, `flow.workspace.open/close`. This private built-in input is not added to generic PluginContext or broadcast through the host registry.

The second built-in registers real theme light/dark actions using the existing palette and `flow.theme.set`, reading only the theme port. The sample module registers one button, one menu command and one panel, plus a bounded custom theme for fallback testing, through the same public interface. It cannot require editing host core.

## Integration sequence

1. M02 confirms these ports/exports; owner then freezes actual TypeScript and tests lifecycle through the public host.
2. Owner commits standalone host+builtins+sample+isolated browser fixture at unused port5190 (verify before listen), without App edits.
3. M02 cherry-picks that scoped commit, constructs ports from current selected task/layout/theme, registers builtins, and mounts semantic slots/panels. App task mutations remain explicit user commands with existing confirmation where required.
4. Module review and App integration have separate SHA/evidence. Real center/M02 validation is required after App integration; fixture is not that proof.

## Invocation-context rules frozen with M02

App/ExtensionSlot passes the actual local discriminated context into the trusted UI host.execute entry. A sidebar action on task B therefore authorizes/executes B even when active pane is A. The host validates context shape and the slot's allowed kind; each command declaration lists accepted context kinds. The immutable CommandContext is captured for that invocation and rechecked after activation. A plugin renderer can call only its bound invocation closure and cannot replace its identity or context.

Slot→kind: activityBar/sidebar.header/sidebar.footer/settings use global; sidebar.item.actions and chat.task.actions use task; chat.header accepts task/composer/global; chat.message.actions requires message; chat.composer.actions requires composer; workspace.header/tabs/actions require workspace; artifact.actions requires reference. Reference-load command additionally checks argument taskId/referenceId against its bound task/workspace/reference context; App verifies membership in the current authoritative projection. chat.open is intentionally navigation and may target a feed/index authoritative ID, not only the active ID.

Workspace builtin's display.task.id and all references must match the provided workspace context.taskId before rendering or dispatch. Its activeTab uses exact WorkspaceTabId. flow.reference.load returns void; details update through the private read-only display port. flow.composer.insertText returns explicit unsupported from the App bridge until a safe composer seam exists; the fixture may supply that supported bridge for draft-preservation testing, without claiming main integration.
