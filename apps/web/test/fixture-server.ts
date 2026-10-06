import { createServer, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  taskFixtures,
  taskSubmissionSchema,
  type Detail,
  type EventPage,
  type TaskSnapshot,
  type TaskSubmission,
  type TaskSummary,
} from "@flow/contracts";

export function createFixture() {
  const tasks = new Map<string, TaskSnapshot>();
  const details = new Map<string, Detail>();
  const streams = new Map<string, Set<ServerResponse>>();
  const saved = new Map<string, { body: string; result: unknown }>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const requests: {
    method: string;
    path: string;
    key?: string;
    body?: string;
  }[] = [];
  let loseNextSubmit = false;
  let detailDelayMs = 0;
  let submitDelayMs = 0;
  let snapshotDelayMs = 0;
  let loseNextSnapshot = false;
  const schedule = (action: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      action();
    }, ms);
    timers.add(timer);
  };
  const summary = (task: TaskSnapshot): TaskSummary => ({
    id: task.id,
    title: task.title,
    harness: task.harness,
    status: task.status,
    verificationStatus: task.verificationStatus,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  });
  const page = (task: TaskSnapshot, after: number): EventPage => {
    const entries = task.entries
      .filter((entry) => entry.cursor > after)
      .slice(0, 100);
    return {
      task: summary(task),
      entries,
      nextCursor: entries.at(-1)?.cursor ?? after,
      watermark: task.watermark,
      hasMore: task.entries.some(
        (entry) => entry.cursor > (entries.at(-1)?.cursor ?? after),
      ),
      pendingDecision: task.pendingDecision,
      usage: task.usage,
    };
  };
  const broadcast = (id: string) => {
    const task = tasks.get(id)!;
    task.updatedAt = new Date().toISOString();
    for (const stream of streams.get(id) ?? [])
      stream.write(
        `event: update\ndata: ${JSON.stringify(page(task, task.watermark))}\n\n`,
      );
  };
  const append = (task: TaskSnapshot, text: string) => {
    task.watermark++;
    task.entries.push({
      id: randomUUID(),
      cursor: task.watermark,
      createdAt: new Date().toISOString(),
      kind: "text",
      text,
    });
  };
  const reference = (task: TaskSnapshot, detail: Detail) => {
    details.set(detail.id, detail);
    task.watermark++;
    task.entries.push({
      id: randomUUID(),
      cursor: task.watermark,
      createdAt: new Date().toISOString(),
      kind: "reference",
      reference: { id: detail.id, title: detail.title },
    });
  };
  const emit = (id: string, after: number) => {
    const task = tasks.get(id)!;
    task.updatedAt = new Date().toISOString();
    for (const stream of streams.get(id) ?? [])
      stream.write(
        `event: update\ndata: ${JSON.stringify(page(task, after))}\n\n`,
      );
  };
  function finish(task: TaskSnapshot, scenario: string) {
    const cursor = task.watermark;
    task.pendingDecision = null;
    if (scenario === "failure") {
      task.status = "failed";
      append(
        task,
        "The execution stopped: the requested source was unavailable. Inspect the error and start a new task when it is available.",
      );
    } else {
      task.status = "succeeded";
      task.verificationStatus =
        scenario === "verification-failure" ? "failed" : "passed";
      append(
        task,
        "The result is ready. The saved artifact and its verification evidence are available below.",
      );
      const content =
        scenario === "large"
          ? "Field observation: the stream remains bounded and this evidence is loaded only when expanded.\n".repeat(
              3000,
            )
          : "# Field notes summary\n\n• The team completed the initial research.\n• Three findings are ready for discussion.\n• The next step is to review the evidence together.\n\nThis is simulated fixture content.";
      const artifactVersion = createHash("sha256")
        .update(content)
        .digest("hex");
      reference(task, {
        id: `${task.id}-artifact`,
        title: "Field notes summary",
        kind: "artifact",
        mediaType: "text/markdown",
        content,
        artifactVersion,
      });
      reference(task, {
        id: `${task.id}-verification`,
        title: "Verification evidence",
        kind: "verification",
        mediaType: "application/json",
        content: JSON.stringify(
          {
            verifier: "flow.text",
            version: "1",
            artifactVersion,
            status: task.verificationStatus,
            evidence:
              task.verificationStatus === "failed"
                ? "Expected text was not found."
                : "The saved artifact is nonempty.",
          },
          null,
          2,
        ),
      });
      task.usage = {
        inputTokens: 1250,
        outputTokens: 384,
        costUsd: null,
        costKind: "unknown",
        incomplete: true,
      };
    }
    emit(task.id, cursor);
  }
  function create(input: TaskSubmission, seedId?: string) {
    const id = seedId ?? randomUUID();
    const now = new Date().toISOString();
    const task: TaskSnapshot = {
      id,
      title: input.title,
      prompt: input.prompt,
      harness: input.harness,
      status: "queued",
      verificationStatus: "pending",
      createdAt: now,
      updatedAt: now,
      entries: [],
      watermark: 0,
      hasMore: false,
      pendingDecision: null,
      attempt: null,
      usage: {
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        costKind: "unknown",
        incomplete: true,
      },
    };
    tasks.set(id, task);
    append(
      task,
      "The center accepted this task. It can continue after you close this page.",
    );
    if (!seedId)
      schedule(() => {
        if (task.status !== "queued") return;
        const cursor = task.watermark;
        task.status = "running";
        append(task, "The runner is working on your request.");
        emit(id, cursor);
        schedule(() => {
          if (task.status !== "running") return;
          if (input.fixture?.scenario === "decision") {
            const before = task.watermark;
            task.status = "waiting";
            task.pendingDecision = {
              id: `${id}-decision`,
              prompt:
                "The checklist is ready. May I create the final artifact?",
            };
            append(
              task,
              "The review is ready. I need your decision before creating the final artifact.",
            );
            emit(id, before);
          } else finish(task, input.fixture?.scenario ?? "success");
        }, input.fixture?.delayMs ?? 700);
      }, 200);
    return task;
  }
  const waiting = create(taskFixtures.decision, "demo-decision");
  waiting.status = "waiting";
  waiting.pendingDecision = {
    id: "demo-decision-request",
    prompt: "The launch checklist is ready. May I create the final artifact?",
  };
  append(
    waiting,
    "I reviewed the launch checklist and found three items that need attention before release.",
  );
  reference(waiting, {
    id: "demo-checklist",
    title: "Launch checklist review",
    kind: "detail",
    mediaType: "text/plain",
    content:
      "1. Confirm the release owner.\n2. Check rollback instructions.\n3. Approve the final launch artifact.\n\nThis is a simulated review.",
  });
  append(
    waiting,
    "The checklist is ready for your review. I will wait for your decision before creating the artifact.",
  );
  const completed = create(taskFixtures.success, "demo-completed");
  finish(completed, "success");
  const verificationFailed = create(
    taskFixtures.verificationFailure,
    "demo-verification",
  );
  finish(verificationFailed, "verification-failure");
  const failed = create(taskFixtures.failure, "demo-failed");
  finish(failed, "failure");
  const running = create(taskFixtures.slow, "demo-running");
  running.status = "running";
  append(
    running,
    "Collecting the next set of results. You can leave this page and come back later.",
  );
  const large = create(taskFixtures.large, "demo-large");
  for (let index = 0; index < 130; index++)
    append(large, `Evidence step ${index + 1}: saved a bounded progress note.`);
  finish(large, "large");
  const uncertain = create(
    { ...taskFixtures.slow, title: "Reconcile runner connection" },
    "demo-uncertain",
  );
  uncertain.status = "uncertain";
  const queued = create(
    { ...taskFixtures.slow, title: "Prepare tomorrow’s briefing" },
    "demo-queued",
  );
  queued.status = "queued";

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const key = req.headers["idempotency-key"] as string | undefined;
    requests.push({
      method,
      path: req.url ?? "/",
      ...(key ? { key } : {}),
      ...(body ? { body } : {}),
    });
    const json = (value: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    const error = (code: string, status: number, message: string) =>
      json({ error: { code, message } }, status);
    if (url.pathname === "/api/health") return json({ fixture: true });
    if (req.headers.authorization !== "Bearer flow-fixture-only")
      return error(
        "unauthorized",
        401,
        "Use the local fixture token for this simulated server.",
      );
    if (url.pathname === "/__fixture/requests") return json(requests);
    if (url.pathname === "/api/tasks" && method === "GET") {
      const list = [...tasks.values()].reverse();
      const start = url.searchParams.get("before");
      const offset = start
        ? list.findIndex((item) => item.id === start) + 1
        : 0;
      const selected = list.slice(offset, offset + 40);
      return json({
        tasks: selected.map(summary),
        nextCursor: list.length > offset + 40 ? selected.at(-1)!.id : null,
      });
    }
    if (method === "POST" && !key)
      return error("missing_key", 400, "Idempotency-Key required.");
    const operation = `${url.pathname}:${key}`;
    if (method === "POST" && saved.has(operation)) {
      const previous = saved.get(operation)!;
      return previous.body === body
        ? json(previous.result, url.pathname === "/api/tasks" ? 202 : 200)
        : error("key_conflict", 409, "Changed content under the same key.");
    }
    try {
      if (url.pathname === "/api/tasks" && method === "POST") {
        const input = taskSubmissionSchema.parse(JSON.parse(body));
        const task = create(input);
        const result = { task: summary(task), replayed: false };
        saved.set(operation, { body, result });
        if (loseNextSubmit) {
          loseNextSubmit = false;
          return res.destroy();
        }
        if (submitDelayMs)
          return schedule(() => json(result, 202), submitDelayMs);
        return json(result, 202);
      }
      const detailId = url.pathname.match(/^\/api\/details\/([^/]+)$/)?.[1];
      if (detailId) {
        const detail = details.get(decodeURIComponent(detailId));
        if (!detail) return error("not_found", 404, "Detail missing.");
        if (detailDelayMs) return schedule(() => json(detail), detailDelayMs);
        return json(detail);
      }
      const match = url.pathname.match(
        /^\/api\/tasks\/([^/]+)(?:\/(events|stream|decision|cancel))?$/,
      );
      if (!match) return error("not_found", 404, "Unknown fixture endpoint.");
      const task = tasks.get(decodeURIComponent(match[1]!));
      if (!task) return error("not_found", 404, "Task missing.");
      const action = match[2];
      if (!action) {
        if (loseNextSnapshot) {
          loseNextSnapshot = false;
          return res.destroy();
        }
        const send = () =>
          json({
            ...task,
            entries: task.entries.slice(-100),
            hasMore: task.entries.length > 100,
          });
        if (snapshotDelayMs) return schedule(send, snapshotDelayMs);
        return send();
      }
      if (action === "events")
        return json(page(task, Number(url.searchParams.get("after") ?? 0)));
      if (action === "stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        let after = Number(url.searchParams.get("after") ?? 0);
        if (after > task.watermark)
          res.write(
            `data: ${JSON.stringify({ ...page(task, 0), reset: true, nextCursor: 0 })}\n\n`,
          );
        else {
          do {
            const update = page(task, after);
            res.write(`event: update\ndata: ${JSON.stringify(update)}\n\n`);
            after = update.nextCursor;
            if (!update.hasMore) break;
          } while (true);
        }
        const observers = streams.get(task.id) ?? new Set();
        observers.add(res);
        streams.set(task.id, observers);
        res.on("close", () => observers.delete(res));
        return;
      }
      if (action === "decision") {
        const input = JSON.parse(body);
        if (
          !task.pendingDecision ||
          input.decisionId !== task.pendingDecision.id
        )
          return error(
            "decision_conflict",
            409,
            "Decision is no longer pending.",
          );
        task.pendingDecision = null;
        if (input.answer === "approve") finish(task, "success");
        else {
          task.status = "cancelled";
          broadcast(task.id);
        }
      }
      if (action === "cancel") {
        task.status = "cancel_requested";
        broadcast(task.id);
        schedule(() => {
          task.status = "cancelled";
          broadcast(task.id);
        }, 650);
      }
      const result = summary(task);
      saved.set(operation, { body, result });
      return json(result);
    } catch (cause) {
      return error(
        "invalid_request",
        400,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  });
  return {
    server,
    tasks,
    details,
    requests,
    activeStreamCount() { return [...streams.values()].reduce((count, group) => count + group.size, 0); },
    loseSubmitResponse() {
      loseNextSubmit = true;
    },
    delaySnapshots(ms: number) {
      snapshotDelayMs = ms;
    },
    loseSnapshotResponse() {
      loseNextSnapshot = true;
    },
    delaySubmissions(ms: number) {
      submitDelayMs = ms;
    },
    delayDetails(ms: number) {
      detailDelayMs = ms;
    },
    dropStreams(id: string) {
      for (const stream of streams.get(id) ?? []) stream.end();
    },
    sendPage(id: string, update: EventPage) {
      for (const stream of streams.get(id) ?? [])
        stream.write(`data: ${JSON.stringify(update)}\n\n`);
    },
    update(id: string, patch: Partial<TaskSnapshot>) {
      Object.assign(tasks.get(id)!, patch);
      broadcast(id);
    },
    close() {
      timers.forEach(clearTimeout);
      for (const group of streams.values())
        for (const stream of group) stream.end();
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const fixture = createFixture();
  fixture.server.listen(
    Number(process.env.FLOW_FIXTURE_PORT ?? 4317),
    "127.0.0.1",
    () =>
      process.stdout.write(
        "Flow HTTP fixture: http://127.0.0.1:4317 (simulated, process-memory state)\n",
      ),
  );
}
