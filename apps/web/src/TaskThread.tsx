import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AssistantRuntimeProvider,
  makeAssistantToolUI,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import {
  taskFixtures,
  TERMINAL_STATUSES,
  type Reference,
  type TaskSubmission,
} from "@flow/contracts";
import { FileText, ArrowUpRight } from "lucide-react";
import { Thread } from "./components/assistant-ui/elements/thread.aui";
import { Button } from "./components/ui/button";
import { PluginThreadScope, MessageActions, ComposerActions } from "./plugin-integration/react";
import type { ProjectionState, TaskProjection } from "./projection";

const ReferenceContext = createContext<(id: string) => void>(() => undefined);
const ReferenceUI = makeAssistantToolUI<Reference, Reference>({
  toolName: "flow_reference",
  render: ({ args }) => {
    const open = useContext(ReferenceContext);
    return (
      <button
        className="flow-reference"
        onClick={() => args.id && open(args.id)}
        aria-label={`Open ${args.title}`}
      >
        <FileText size={15} />
        <span>
          {args.title}
          <small>{args.id}</small>
        </span>
        <ArrowUpRight size={14} />
      </button>
    );
  },
});
const referenceComponents = {
  MessageActions, ComposerActions,
  ToolGroup: ({ children }: { children?: ReactNode }) => <>{children}</>,
};
const choices = Object.entries(taskFixtures) as [
  keyof typeof taskFixtures,
  TaskSubmission,
][];
export interface DraftState {
  text: string;
  harness: "fixture" | "claude";
  scenario: keyof typeof taskFixtures;
}
export const fixtureMode = import.meta.env.VITE_FLOW_FIXTURE === "true";

export function TaskThread({
  viewId,
  state,
  projection,
  drafts,
  onAccepted,
  onOpenReference,
}: {
  viewId: string;
  state: ProjectionState;
  projection: TaskProjection;
  drafts: Map<string, DraftState>;
  onAccepted: (id: string) => void;
  onOpenReference: (id: string) => void;
}) {
  const task = state.task;
  const [harness, setHarness] = useState<"fixture" | "claude">(
    drafts.get(viewId)?.harness ?? (fixtureMode ? "fixture" : "claude"),
  );
  const [scenario, setScenario] = useState<keyof typeof taskFixtures>(
    drafts.get(viewId)?.scenario ?? "success",
  );
  const messages = useMemo<ThreadMessageLike[]>(
    () =>
      task
        ? [
            {
              id: `prompt-${task.id}`,
              role: "user",
              content: task.prompt,
              createdAt: new Date(task.createdAt),
            },
            ...task.entries.map((entry) => ({
              id: entry.id,
              role: "assistant" as const,
              createdAt: new Date(entry.createdAt),
              content:
                entry.kind === "text"
                  ? entry.text
                  : [
                      {
                        type: "tool-call" as const,
                        toolCallId: entry.id,
                        toolName: "flow_reference",
                        args: entry.reference,
                        argsText: JSON.stringify(entry.reference),
                        result: entry.reference,
                      },
                    ],
            })),
          ]
        : [],
    [task?.id, task?.prompt, task?.createdAt, task?.entries],
  );
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage: (message) => message,
    isRunning: task?.status === "running",
    isDisabled: Boolean(task) || (!viewId.startsWith("draft-") && !task),
    isLoading: !viewId.startsWith("draft-") && !task,
    onNew: async (message) => {
      const prompt = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      const input: TaskSubmission = {
        ...(harness === "fixture"
          ? taskFixtures[scenario]
          : { harness: "claude" }),
        title: prompt.trim().split("\n")[0]!.slice(0, 180),
        prompt,
      };
      const id = await projection.submit(input);
      if (!id) {
        // ExternalStoreRuntime clears its composer when sending. Restore an
        // ambiguous submission only when the user has not typed a newer draft.
        if (!runtime.thread.composer.getState().text)
          runtime.thread.composer.setText(prompt);
        throw new Error(
          projection.getSnapshot().error ??
            "The center has not acknowledged this task. Retry to reuse the request key.",
        );
      }
      drafts.delete(viewId);
      onAccepted(id);
    },
  });
  useEffect(() => {
    runtime.thread.composer.setText(drafts.get(viewId)?.text ?? "");
    return runtime.thread.composer.subscribe(() => {
      const text = runtime.thread.composer.getState().text;
      drafts.set(viewId, { harness, scenario, ...drafts.get(viewId), text });
    });
  }, [runtime, viewId, drafts]);
  return (
    <PluginThreadScope viewId={viewId} taskId={task?.id ?? null}><ReferenceContext.Provider value={onOpenReference}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ReferenceUI />
        <Thread
          components={referenceComponents}
          autoFocus={false}
          beforeMessages={
            state.olderAvailable ? (
              <Button
                variant="ghost"
                size="sm"
                className="mx-auto mb-4"
                onClick={async (event) => {
                  const viewport = event.currentTarget.closest(
                    '[data-slot="aui_thread-viewport"]',
                  ) as HTMLElement | null;
                  const beforeHeight = viewport?.scrollHeight ?? 0;
                  const beforeTop = viewport?.scrollTop ?? 0;
                  await projection.loadEarlier();
                  requestAnimationFrame(() => {
                    if (viewport) {
                      viewport.scrollTop =
                        beforeTop + viewport.scrollHeight - beforeHeight;
                      viewport.tabIndex = -1;
                      viewport.focus({ preventScroll: true });
                    }
                  });
                }}
              >
                Load earlier activity
              </Button>
            ) : null
          }
          composerHeader={
            <div className="flow-composer-options">
              <label>
                Backend
                <select
                  aria-label="Execution backend"
                  value={harness}
                  onChange={(event) => {
                    const next = event.target.value as "fixture" | "claude";
                    setHarness(next);
                    drafts.set(viewId, {
                      text: runtime.thread.composer.getState().text,
                      scenario,
                      harness: next,
                    });
                  }}
                >
                  <option value="claude">Claude runner</option>
                  <option value="fixture">HTTP fixture</option>
                </select>
              </label>
              {harness === "fixture" && (
                <label>
                  Scenario
                  <select
                    aria-label="Fixture scenario"
                    value={scenario}
                    onChange={(event) => {
                      const next = event.target
                        .value as keyof typeof taskFixtures;
                      setScenario(next);
                      drafts.set(viewId, {
                        text: taskFixtures[next].prompt,
                        harness,
                        scenario: next,
                      });
                      runtime.thread.composer.setText(
                        taskFixtures[next].prompt,
                      );
                    }}
                  >
                    {choices.map(([name, fixture]) => (
                      <option key={name} value={name}>
                        {fixture.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          }
          footer={
            task ? (
              <div className="flow-task-footer">
                {task.pendingDecision && task.status === "waiting" ? (
                  <section aria-label="Decision required">
                    <h2>Your decision is needed</h2>
                    <p>{task.pendingDecision.prompt}</p>
                    <div>
                      <Button
                        size="sm"
                        disabled={state.pending}
                        onClick={() => void projection.decide("approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={state.pending}
                        onClick={() => void projection.decide("reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </section>
                ) : (
                  <p>
                    {task.status === "cancel_requested"
                      ? "Cancellation requested. Waiting for the runner to acknowledge that it stopped."
                      : task.status === "uncertain"
                        ? "Runner ownership was lost. Reconciliation is required; work may already have taken effect."
                        : TERMINAL_STATUSES.includes(task.status)
                          ? `This task has ${task.status === "succeeded" ? "completed" : task.status === "failed" ? "failed" : "been cancelled"}. Start a new chat for another task.`
                          : "This accepted task continues at the center. Start a new chat for another task."}
                  </p>
                )}
                {task.verificationStatus === "failed" && (
                  <p className="flow-error">
                    Artifact verification failed. The result and evidence are
                    retained.
                  </p>
                )}
              </div>
            ) : (
              <p className="flow-composer-note">
                Submitting creates a durable task. Closing a chat does not
                cancel it.
              </p>
            )
          }
        />
      </AssistantRuntimeProvider>
    </ReferenceContext.Provider></PluginThreadScope>
  );
}
