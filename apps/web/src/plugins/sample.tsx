import type { PluginDefinition, PluginViewProps } from "./types";
import { useState } from "react";
/** Third definition exercises the public extension surface; no host special cases. */
export function createSamplePlugin(
  options: { failFirstLoad?: boolean; throwRender?: () => boolean } = {},
): PluginDefinition {
  let loads = 0;
  return {
    manifest: {
      id: "sample.notes",
      version: "1.0.0",
      hostApi: 1,
      capabilities: [
        "ui.navigate",
        "ui.layout",
        "theme.write",
        "theme.register",
        "composer.write",
      ],
      activationEvents: [
        "command:sample.notes.open",
        "command:sample.notes.theme",
        "command:sample.notes.insert",
        "command:sample.notes.split",
        "command:sample.notes.merge",
        "command:sample.notes.close-view",
        "view:workspace.tabs",
      ],
      commands: [
        {
          id: "sample.notes.open",
          title: "Open task",
          capability: "ui.navigate",
          contexts: ["task", "conversation"],
        },
        {
          id: "sample.notes.theme",
          title: "Ocean theme",
          capability: "theme.write",
          contexts: ["global", "workspace"],
        },
        {
          id: "sample.notes.insert",
          title: "Insert note",
          capability: "composer.write",
          contexts: ["composer"],
        },
        { id: "sample.notes.split", title: "Split this chat", capability: "ui.layout", contexts: ["pane"] },
        { id: "sample.notes.merge", title: "Merge these panes", capability: "ui.layout", contexts: ["pane"] },
        { id: "sample.notes.close-view", title: "Close this chat", capability: "ui.navigate", contexts: ["pane"] },
      ],
      contributions: [
        { kind: "menu", id: "sample.notes.split-menu", title: "Split this chat", slot: "chat.tab.actions", commandId: "sample.notes.split" },
        { kind: "menu", id: "sample.notes.merge-menu", title: "Merge these panes", slot: "chat.tab.actions", commandId: "sample.notes.merge" },
        { kind: "menu", id: "sample.notes.close-view-menu", title: "Close this chat", slot: "chat.tab.actions", commandId: "sample.notes.close-view" },
        {
          kind: "button",
          id: "sample.notes.open-button",
          title: "Open from plugin",
          slot: "sidebar.item.actions",
          commandId: "sample.notes.open",
        },
        {
          kind: "menu",
          id: "sample.notes.theme-menu",
          title: "Ocean theme",
          slot: "activityBar.bottom",
          commandId: "sample.notes.theme",
        },
        {
          kind: "button",
          id: "sample.notes.insert-button",
          title: "Insert note",
          slot: "chat.composer.actions",
          commandId: "sample.notes.insert",
        },
        {
          kind: "panel",
          id: "sample.notes.panel",
          title: "Notes",
          slot: "workspace.tabs",
          capability: "ui.navigate",
        },
        {
          kind: "theme",
          id: "sample.notes.ocean",
          theme: {
            id: "sample.notes.ocean",
            label: "Ocean",
            scheme: "dark",
            tokens: {
              background: "#132129",
              foreground: "#f1f6fa",
              card: "#132129",
              border: "#395262",
            },
          },
        },
      ],
    },
    load: async () => {
      if (options.failFirstLoad && ++loads === 1)
        throw Error("Fixture loader failed once");
      return {
        activate(context) {
          context.command("sample.notes.open", {
            parse: () => undefined,
            run: async (_, command) => {
              if (command.resource.kind === "conversation") {
                await command.execute("flow.conversation.open", { conversationId: command.resource.conversationId }); return;
              }
              if (command.resource.kind !== "task")
                throw Error("Task required");
              await command.execute("flow.chat.open", {
                taskId: command.resource.taskId,
              });
            },
          });
          for (const kind of ["split", "merge"] as const) context.command(`sample.notes.${kind}`, {
            parse: () => undefined,
            run: async (_, command) => {
              if (command.resource.kind !== "pane") throw Error("Actual conversation pane required");
              await command.execute("flow.layout.change", { paneId: command.resource.paneId, change: { kind } });
            },
          });
          context.command("sample.notes.close-view", {
            parse: () => undefined,
            run: async (_, command) => {
              if (command.resource.kind !== "pane") throw Error("Actual conversation pane required");
              await command.execute("flow.view.close", { viewKey: command.resource.viewKey });
            },
          });
          context.command("sample.notes.theme", {
            parse: () => undefined,
            run: async (_, command) => {
              await command.execute("flow.theme.set", {
                themeId: "sample.notes.ocean",
              });
            },
          });
          context.command("sample.notes.insert", {
            parse: () => undefined,
            run: async (_, command) => {
              if (command.resource.kind !== "composer")
                throw Error("Composer required");
              await command.execute("flow.composer.insertText", {
                viewId: command.resource.viewId,
                text: "Plugin note",
              });
            },
          });
          function Notes({ execute, context: resource }: PluginViewProps) {
            const [error, setError] = useState<string>();
            if (options.throwRender?.()) throw Error("Fixture render failed");
            return (
              <article data-context-frozen={Object.isFrozen(resource)}>
                <h3>Notes extension</h3>
                <p>
                  A separately registered panel using the same host interface.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError(undefined);
                    void execute("sample.notes.theme").then((result) => {
                      if (!result.ok) setError(result.error);
                    });
                  }}
                >
                  Use Ocean theme
                </button>
                {error && <p role="alert">{error}</p>}
              </article>
            );
          }
          context.contribute("sample.notes.panel", Notes);
        },
      };
    },
  };
}
