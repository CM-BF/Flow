import type {
  Capability,
  ContextKind,
  PluginManifest,
  ResourceContext,
  SlotId,
  ThemeDefinition,
} from "./types";
export const slots: Readonly<Record<SlotId, readonly ContextKind[]>> = {
  "activityBar.primary": ["global"],
  "activityBar.bottom": ["global"],
  "sidebar.header": ["global"],
  "sidebar.item.actions": ["task", "conversation"],
  "sidebar.footer": ["global"],
  "chat.header": ["global", "task", "composer"],
  "chat.tab.actions": ["pane"],
  "chat.task.actions": ["task"],
  "chat.message.actions": ["message"],
  "chat.message.footer": ["message"],
  "chat.composer.actions": ["composer"],
  "chat.composer.context": ["composer"],
  "workspace.header": ["workspace"],
  "workspace.tabs": ["workspace"],
  "workspace.actions": ["workspace"],
  "artifact.actions": ["reference"],
  "settings.sections": ["global"],
};
const capabilities: readonly Capability[] = [
  "ui.navigate",
  "ui.layout",
  "reference.read",
  "task.activity.read",
  "task.steering.read",
  "task.steering.write",
  "task.assistant-stream.read",
  "theme.write",
  "theme.register",
  "workspace.read",
  "attachment.read",
  "attachment.upload",
  "knowledge.read",
  "composer.write",
  "clipboard.write",
];
const contextKinds: readonly ContextKind[] = [
  "conversation",
  "pane",
  "global",
  "task",
  "message",
  "composer",
  "workspace",
  "reference",
];
const tokenNames = new Set([
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
]);
const idPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
export function validateContext(value: ResourceContext): ResourceContext {
  assert(
    value && contextKinds.includes(value.kind),
    "Invalid invocation context",
  );
  if (value.kind === "conversation") assert(text(value.conversationId), "Conversation context requires its actual ID");
  if (value.kind === "pane") assert(text(value.workspaceId) && text(value.paneId) && text(value.viewKey), "Pane context requires workspace, pane and stable view IDs");
  if (
    value.kind === "task" ||
    value.kind === "message" ||
    value.kind === "reference"
  )
    assert(text(value.taskId), "Task context requires taskId");
  if (value.kind === "message")
    assert(
      text(value.messageId) &&
        (value.role === "user" || value.role === "assistant"),
      "Message context requires messageId and role",
    );
  if (value.kind === "reference")
    assert(text(value.referenceId), "Reference context requires referenceId");
  if (value.kind === "composer")
    assert(
      text(value.viewId) && typeof value.isDraft === "boolean",
      "Composer context requires viewId and isDraft",
    );
  if (value.kind === "workspace")
    assert(
      (value.taskId === null || text(value.taskId)) &&
        (value.tabId === "files" ||
          value.tabId === "terminal" ||
          (text(value.tabId) &&
            value.tabId.startsWith("detail:") &&
            value.tabId.length > 7)),
      "Invalid workspace context",
    );
  const keys = {
    conversation: ["kind", "conversationId"],
    pane: ["kind", "workspaceId", "paneId", "viewKey"],
    global: ["kind"],
    task: ["kind", "taskId"],
    message: ["kind", "taskId", "messageId", "role"],
    composer: ["kind", "viewId", "isDraft"],
    workspace: ["kind", "taskId", "tabId"],
    reference: ["kind", "taskId", "referenceId"],
  }[value.kind];
  assert(
    Object.keys(value).every((key) => keys.includes(key)),
    "Unexpected invocation context field",
  );
  return immutable({ ...value });
}
export function validateSlot(slot: SlotId, context: ResourceContext) {
  validateContext(context);
  assert(
    Object.hasOwn(slots, slot) && slots[slot].includes(context.kind),
    `Context ${context.kind} is not valid for ${slot}`,
  );
}
function validateTheme(theme: ThemeDefinition) {
  assert(
    text(theme.id) &&
      text(theme.label) &&
      (theme.scheme === "light" || theme.scheme === "dark"),
    "Invalid theme declaration",
  );
  assert(
    theme.tokens && typeof theme.tokens === "object",
    "Theme tokens must be an object",
  );
  for (const [key, value] of Object.entries(theme.tokens)) {
    assert(tokenNames.has(key), `Unsupported theme token: ${key}`);
    assert(
      typeof value === "string" &&
        /^(#[\da-f]{3,8}|(?:rgb|hsl|oklch)a?\([\d\s.,%/+-]+\))$/i.test(value),
      `Unsupported color value: ${key}`,
    );
  }
}
function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    assert(Number.isFinite(value), "Manifest numbers must be finite");
    return;
  }
  assert(typeof value === "object", "Manifest must contain JSON data only");
  assert(!ancestors.has(value), "Manifest must not contain cycles");
  assert(
    Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype,
    "Manifest objects must be plain JSON",
  );
  ancestors.add(value);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (Array.isArray(value) && key === "length") continue;
    assert("value" in descriptor, "Manifest must not contain accessors");
    assertJson(descriptor.value, ancestors);
  }
  ancestors.delete(value);
}
export function validateManifest(input: PluginManifest): PluginManifest {
  assertJson(input);
  const serialized = JSON.stringify(input);
  const manifest = JSON.parse(serialized) as PluginManifest;
  assert(manifest.hostApi === 1, "Unsupported host API version");
  assert(idPattern.test(manifest.id), "Plugin ID must be namespaced");
  assert(
    /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version),
    "Invalid plugin version",
  );
  assert(
    Array.isArray(manifest.capabilities) &&
      manifest.capabilities.every((cap) => capabilities.includes(cap)),
    "Unknown capability",
  );
  assert(
    Array.isArray(manifest.commands) &&
      Array.isArray(manifest.contributions) &&
      Array.isArray(manifest.activationEvents),
    "Manifest declarations must be arrays",
  );
  const ids = new Set<string>();
  const reserve = (id: string) => {
    assert(
      idPattern.test(id) && id.startsWith(`${manifest.id}.`),
      "Contribution and command IDs must use the plugin namespace",
    );
    assert(!ids.has(id), `Duplicate declared ID: ${id}`);
    ids.add(id);
  };
  for (const command of manifest.commands) {
    reserve(command.id);
    assert(
      text(command.title) && manifest.capabilities.includes(command.capability),
      "Invalid command capability/title",
    );
    assert(
      Array.isArray(command.contexts) &&
        command.contexts.length > 0 &&
        command.contexts.every((kind: ContextKind) =>
          contextKinds.includes(kind),
        ),
      "Invalid command contexts",
    );
  }
  for (const contribution of manifest.contributions) {
    reserve(contribution.id);
    if (contribution.kind === "theme") {
      assert(
        manifest.capabilities.includes("theme.register"),
        "Theme registration requires capability",
      );
      validateTheme(contribution.theme);
      assert(
        contribution.theme.id === contribution.id,
        "Theme ID must match contribution ID",
      );
      continue;
    }
    assert(
      Object.hasOwn(slots, contribution.slot) && text(contribution.title),
      "Invalid contribution slot/title",
    );
    if (contribution.kind === "panel") {
      assert(
        ["workspace.tabs", "settings.sections", "chat.message.footer", "chat.composer.context"].includes(contribution.slot) &&
          manifest.capabilities.includes(contribution.capability),
        "Invalid panel contribution",
      );
    } else {
      assert(
        contribution.kind === "button" || contribution.kind === "menu",
        "Unknown contribution kind",
      );
      assert(
        manifest.commands.some(
          (command) => command.id === contribution.commandId,
        ),
        "Contribution references an undeclared command",
      );
    }
  }
  for (const event of manifest.activationEvents)
    assert(
      typeof event === "string" &&
        (event.startsWith("command:")
          ? manifest.commands.some((command) => command.id === event.slice(8))
          : event.startsWith("view:") && Object.hasOwn(slots, event.slice(5))),
      "Invalid activation event",
    );
  return immutable(manifest);
}
