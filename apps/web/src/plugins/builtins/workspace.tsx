import { useState, useSyncExternalStore } from "react";
import { WorkspacePanels } from "../../components/workspace/WorkspacePanels";
import type {
  CommandContext,
  PluginModule,
  PluginViewProps,
  Readable,
  WorkspaceDisplay,
  WorkspaceTabId,
} from "../types";
import { assert, validateContext } from "../validation";
function taskId(context: CommandContext) {
  assert(
    context.resource.kind === "workspace" && context.resource.taskId,
    "Workspace requires a selected task",
  );
  return context.resource.taskId;
}
export function createWorkspaceModule(
  workspace: Readable<WorkspaceDisplay>,
): PluginModule {
  return {
    activate(context) {
      context.command("flow.workspace.tab", {
        parse: (args) => {
          assert(
            args && typeof args === "object" && "tab" in args,
            "Missing workspace tab",
          );
          const tab = (args as { tab: WorkspaceTabId }).tab;
          validateContext({ kind: "workspace", taskId: null, tabId: tab });
          return tab;
        },
        run: async (tab, command) => {
          await command.execute("flow.workspace.open", {
            taskId: taskId(command),
            tab,
          });
        },
      });
      context.command("flow.workspace.detail", {
        parse: (args) => {
          assert(
            args &&
              typeof args === "object" &&
              "referenceId" in args &&
              typeof args.referenceId === "string",
            "Missing reference ID",
          );
          return args.referenceId;
        },
        run: async (referenceId, command) => {
          const id = taskId(command);
          const display = workspace.getSnapshot();
          assert(
            display.task?.id === id &&
              display.task.entries.some(
                (entry) =>
                  entry.kind === "reference" &&
                  entry.reference.id === referenceId,
              ),
            "Reference is not in the displayed task",
          );
          await command.execute("flow.reference.load", {
            taskId: id,
            referenceId,
          });
        },
      });
      context.command("flow.workspace.close", {
        parse: () => undefined,
        run: async (_, command) => {
          await command.execute("flow.workspace.close", {});
        },
      });
      function WorkspaceAdapter({
        context: resource,
        execute,
      }: PluginViewProps) {
        const display = useSyncExternalStore(
          workspace.subscribe,
          workspace.getSnapshot,
        );
        const [error, setError] = useState<string>();
        const matches =
          resource.kind === "workspace" &&
          (display.task?.id ?? null) === resource.taskId;
        const run = async (id: string, args?: unknown) => {
          setError(undefined);
          const result = await execute(id, args);
          if (!result.ok) setError(result.error);
        };
        return (
          <>
            {error && <p role="alert">{error}</p>}
            {!matches && (
              <p role="status">Select a matching task to view its workspace.</p>
            )}
            <div hidden={!matches}>
              <WorkspacePanels
                task={matches ? display.task : null}
                details={matches ? display.details : {}}
                connection={display.connection}
                activeTab={
                  resource.kind === "workspace" ? resource.tabId : "files"
                }
                onActiveTabChange={(tab) => {
                  void run("flow.workspace.tab", { tab });
                }}
                onLoadDetail={(referenceId) =>
                  run("flow.workspace.detail", { referenceId })
                }
                onClose={() => {
                  void run("flow.workspace.close");
                }}
              />
            </div>
          </>
        );
      }
      context.contribute("flow.workspace.panel", WorkspaceAdapter);
    },
  };
}
