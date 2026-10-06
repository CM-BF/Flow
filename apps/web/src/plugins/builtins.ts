import type { BuiltinPorts, PluginDefinition } from "./types";
export function createBuiltinPlugins(ports: BuiltinPorts): PluginDefinition[] {
  return [
    {
      manifest: {
        id: "flow.workspace",
        version: "1.0.0",
        hostApi: 1,
        capabilities: ["ui.layout", "workspace.read", "reference.read"],
        activationEvents: [
          "view:workspace.tabs",
          "command:flow.workspace.tab",
          "command:flow.workspace.detail",
          "command:flow.workspace.close",
        ],
        commands: [
          {
            id: "flow.workspace.tab",
            title: "Open workspace tab",
            capability: "ui.layout",
            contexts: ["workspace"],
          },
          {
            id: "flow.workspace.detail",
            title: "Load reference",
            capability: "reference.read",
            contexts: ["workspace"],
          },
          {
            id: "flow.workspace.close",
            title: "Close workspace",
            capability: "ui.layout",
            contexts: ["workspace"],
          },
        ],
        contributions: [
          {
            kind: "panel",
            id: "flow.workspace.panel",
            title: "Task workspace",
            slot: "workspace.tabs",
            capability: "workspace.read",
          },
        ],
      },
      load: async () => {
        const module = await import("./builtins/workspace");
        return module.createWorkspaceModule(ports.workspace);
      },
    },
    {
      manifest: {
        id: "flow.theme",
        version: "1.0.0",
        hostApi: 1,
        capabilities: ["theme.write"],
        activationEvents: [
          "command:flow.theme.light",
          "command:flow.theme.dark",
          "view:settings.sections",
        ],
        commands: [
          {
            id: "flow.theme.light",
            title: "Light theme",
            capability: "theme.write",
            contexts: ["global"],
          },
          {
            id: "flow.theme.dark",
            title: "Dark theme",
            capability: "theme.write",
            contexts: ["global"],
          },
        ],
        contributions: [
          {
            kind: "button",
            id: "flow.theme.light-button",
            title: "Light theme",
            slot: "activityBar.bottom",
            commandId: "flow.theme.light",
          },
          {
            kind: "button",
            id: "flow.theme.dark-button",
            title: "Dark theme",
            slot: "activityBar.bottom",
            commandId: "flow.theme.dark",
          },
          {
            kind: "panel",
            id: "flow.theme.settings",
            title: "Appearance",
            slot: "settings.sections",
            capability: "theme.write",
          },
        ],
      },
      load: () => import("./builtins/theme"),
    },
  ];
}
