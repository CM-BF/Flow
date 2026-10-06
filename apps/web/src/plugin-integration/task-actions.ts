import type { PluginDefinition } from "../plugins/types";

/** A product adapter uses the same declarations and lazy lifecycle as the other trusted plugins. */
export function createTaskActionsPlugin(): PluginDefinition {
  return {
    manifest: {
      id: "flow.task-actions", version: "1.0.0", hostApi: 1,
      capabilities: ["ui.layout", "reference.read"],
      activationEvents: ["command:flow.task-actions.output", "command:flow.task-actions.reference"],
      commands: [
        { id: "flow.task-actions.output", title: "Task output", capability: "ui.layout", contexts: ["message", "task"] },
        { id: "flow.task-actions.reference", title: "Read reference", capability: "reference.read", contexts: ["reference"] },
      ],
      contributions: [
        { kind: "button", id: "flow.task-actions.message-output", slot: "chat.message.actions", title: "Task output", commandId: "flow.task-actions.output" },
        { kind: "button", id: "flow.task-actions.reference-read", slot: "artifact.actions", title: "Read reference", commandId: "flow.task-actions.reference" },
      ],
    },
    load: async () => ({ activate(context) {
      context.command("flow.task-actions.output", { parse: () => undefined, run: async (_, command) => {
        if (command.resource.kind !== "message" && command.resource.kind !== "task") throw Error("A task message is required.");
        await command.execute("flow.workspace.open", { taskId: command.resource.taskId, tab: "terminal" });
      } });
      context.command("flow.task-actions.reference", { parse: () => undefined, run: async (_, command) => {
        if (command.resource.kind !== "reference") throw Error("A task reference is required.");
        await command.execute("flow.reference.load", { taskId: command.resource.taskId, referenceId: command.resource.referenceId });
      } });
    } }),
  };
}
