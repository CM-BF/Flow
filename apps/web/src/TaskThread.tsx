import { createContext, useContext, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { Reference, TaskSnapshot } from "@flow/contracts";
import { ChevronDown, FileText } from "lucide-react";
import type { ProjectionState, TaskProjection } from "./projection";
import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "./components/ai-elements/artifact";

const DetailsContext = createContext<{
  projection: TaskProjection;
  details: ProjectionState["details"];
} | null>(null);

function ReferenceDetail({ reference }: { reference: Reference }) {
  const context = useContext(DetailsContext)!;
  const [expanded, setExpanded] = useState(false);
  const detail = context.details[reference.id];
  const regionId = `detail-${reference.id}`;
  return (
    <div className="reference">
      <button
        className="reference-toggle"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) void context.projection.loadDetail(reference.id);
        }}
      >
        <FileText size={18} />
        <span>
          {reference.title}
          <small>{reference.id}</small>
        </span>
        <ChevronDown className={expanded ? "rotated" : ""} size={18} />
      </button>
      {expanded && (
        <div id={regionId}>
          {detail?.loading && (
            <p className="detail-loading" role="status">
              Loading detail…
            </p>
          )}
          {detail?.error && (
            <div className="notice error" role="alert">
              {detail.error}{" "}
              <button
                onClick={() => void context.projection.loadDetail(reference.id)}
              >
                Retry detail
              </button>
            </div>
          )}
          {detail?.data && (
            <Artifact>
              <ArtifactHeader>
                <div>
                  <ArtifactTitle>{detail.data.title}</ArtifactTitle>
                  <ArtifactDescription>
                    {detail.data.kind} · {detail.data.mediaType}
                  </ArtifactDescription>
                </div>
              </ArtifactHeader>
              <ArtifactContent>
                {detail.data.artifactVersion && (
                  <p className="version">
                    Artifact version <code>{detail.data.artifactVersion}</code>
                  </p>
                )}
                <pre tabIndex={0} aria-label={`${reference.title} content`}>
                  {detail.data.content}
                </pre>
              </ArtifactContent>
            </Artifact>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineMessage() {
  const role = useAuiState((state) => state.message.role);
  const reference = useAuiState(
    (state) => state.message.metadata.custom.reference,
  ) as Reference | undefined;
  return (
    <MessagePrimitive.Root className={`timeline-message ${role}`}>
      <div className="message-avatar" aria-hidden="true">
        {role === "user" ? "Y" : "F"}
      </div>
      <div className="message-body">
        <span className="message-author">
          {role === "user" ? "You" : "Flow"}
        </span>
        {reference ? (
          <ReferenceDetail reference={reference} />
        ) : (
          <MessagePrimitive.Parts />
        )}
      </div>
    </MessagePrimitive.Root>
  );
}

export function TaskThread({
  task,
  projection,
  details,
}: {
  task: TaskSnapshot;
  projection: TaskProjection;
  details: ProjectionState["details"];
}) {
  const messages = useMemo<ThreadMessageLike[]>(
    () => [
      {
        id: `prompt-${task.id}`,
        role: "user",
        content: task.prompt,
        createdAt: new Date(task.createdAt),
      },
      ...task.entries.map((entry) => ({
        id: entry.id,
        role: "assistant" as const,
        content: entry.kind === "text" ? entry.text : entry.reference.title,
        createdAt: new Date(entry.createdAt),
        metadata: {
          custom:
            entry.kind === "reference" ? { reference: entry.reference } : {},
        },
      })),
    ],
    [task.id, task.prompt, task.createdAt, task.entries],
  );
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage: (message) => message,
    isRunning: task.status === "running",
    isDisabled: true,
    onNew: async () => {
      throw new Error("Use New task to submit a separate durable task.");
    },
  });
  return (
    <DetailsContext.Provider value={{ projection, details }}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="thread">
          <ThreadPrimitive.Messages components={{ Message: TimelineMessage }} />
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </DetailsContext.Provider>
  );
}
