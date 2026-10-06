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
        "theme.write",
        "theme.register",
        "composer.write",
      ],
      activationEvents: [
        "command:sample.notes.open",
        "command:sample.notes.theme",
        "command:sample.notes.insert",
        "view:workspace.tabs",
      ],
      commands: [
        {
          id: "sample.notes.open",
          title: "Open task",
          capability: "ui.navigate",
          contexts: ["task"],
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
      ],
      contributions: [
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
              if (command.resource.kind !== "task")
                throw Error("Task required");
              await command.execute("flow.chat.open", {
                taskId: command.resource.taskId,
              });
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
          function Notes({ execute }: PluginViewProps) {
            const [error, setError] = useState<string>();
            if (options.throwRender?.()) throw Error("Fixture render failed");
            return (
              <article>
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
              </article>
            );
          }
          context.contribute("sample.notes.panel", Notes);
        },
      };
    },
  };
}
