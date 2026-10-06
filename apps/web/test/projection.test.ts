import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { FlowClient } from "@flow/client";
import { taskFixtures, type EventPage } from "@flow/contracts";
import { TaskProjection } from "../src/projection";
import { createFixture } from "./fixture-server";

let fixture: ReturnType<typeof createFixture>;
let projection: TaskProjection;
let baseUrl: string;
const until = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Expected projection state did not arrive.");
};
beforeEach(async () => {
  fixture = createFixture();
  await new Promise<void>((resolve) =>
    fixture.server.listen(0, "127.0.0.1", resolve),
  );
  baseUrl = `http://127.0.0.1:${(fixture.server.address() as AddressInfo).port}`;
  projection = new TaskProjection(
    new FlowClient({ baseUrl, token: "flow-fixture-only" }),
    10,
  );
});
afterEach(async () => {
  projection.disconnect();
  await fixture.close();
});

describe("center-driven projection over the public HTTP client", () => {
  it("accepts once after a lost response and assigns a new key for changed input", async () => {
    fixture.loseSubmitResponse();
    expect(await projection.submit(taskFixtures.slow)).toBeUndefined();
    const accepted = await projection.submit(taskFixtures.slow);
    expect(accepted).toBeTruthy();
    const posts = fixture.requests.filter((req) => req.method === "POST");
    expect(posts[0]!.key).toBe(posts[1]!.key);
    expect(fixture.tasks.size).toBe(9);
    fixture.loseSubmitResponse();
    await projection.submit({ ...taskFixtures.slow, title: "Original input" });
    await projection.submit({ ...taskFixtures.slow, title: "Changed input" });
    const latest = fixture.requests
      .filter((req) => req.method === "POST")
      .slice(-2);
    expect(latest[0]!.key).not.toBe(latest[1]!.key);
  });
  it("keeps a late durable acceptance closed after its view disconnects", async () => {
    fixture.delaySubmissions(80);
    const acceptance = projection.submit(taskFixtures.slow);
    await until(() =>
      fixture.requests.some((request) => request.method === "POST"),
    );
    projection.disconnect();
    const id = await acceptance;
    expect(fixture.tasks.has(id!)).toBe(true);
    expect(projection.getSnapshot().task).toBeNull();
    expect(
      fixture.requests.some(
        (request) =>
          request.path.includes("/stream") || request.path.endsWith("/cancel"),
      ),
    ).toBe(false);
  });
  it("disconnects the observer without cancellation and reopens the accepted task", async () => {
    const id = await projection.submit({
      ...taskFixtures.slow,
      fixture: { scenario: "slow", delayMs: 250 },
    });
    projection.disconnect();
    await until(() => fixture.tasks.get(id!)?.status === "succeeded");
    expect(fixture.requests.some((req) => req.path.includes("/cancel"))).toBe(
      false,
    );
    await projection.select(id!);
    expect(projection.getSnapshot().task?.status).toBe("succeeded");
  });
  it("reconnects from delivered nextCursor, not a newer watermark, and applies empty state frames", async () => {
    await projection.select("demo-running");
    await until(() =>
      fixture.requests.some((req) => req.path.includes("/stream")),
    );
    const task = fixture.tasks.get("demo-running")!;
    const update: EventPage = {
      entries: [],
      nextCursor: 2,
      watermark: 80,
      hasMore: true,
      task: {
        id: task.id,
        title: task.title,
        harness: task.harness,
        status: "waiting",
        verificationStatus: task.verificationStatus,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
      pendingDecision: { id: "empty-decision", prompt: "Approve?" },
      usage: {
        inputTokens: 42,
        outputTokens: null,
        costUsd: null,
        costKind: "unknown",
        incomplete: true,
      },
    };
    fixture.sendPage(task.id, update);
    await until(() => projection.getSnapshot().task?.status === "waiting");
    expect(projection.getSnapshot().task?.pendingDecision?.id).toBe(
      "empty-decision",
    );
    expect(projection.getSnapshot().task?.usage.inputTokens).toBe(42);
    fixture.dropStreams(task.id);
    await until(
      () =>
        fixture.requests.filter((req) => req.path.includes("/stream")).length >=
        2,
    );
    expect(
      fixture.requests.filter((req) => req.path.includes("/stream")).at(-1)
        ?.path,
    ).toContain("after=2");
    expect(fixture.requests.some((req) => req.path.includes("after=80"))).toBe(
      false,
    );
  });
  it("reloads snapshot after reset and preserves execution success with failed verification", async () => {
    await projection.select("demo-verification");
    await until(() =>
      fixture.requests.some((req) => req.path.includes("/stream")),
    );
    const task = fixture.tasks.get("demo-verification")!;
    fixture.sendPage(task.id, {
      entries: [],
      nextCursor: 0,
      watermark: task.watermark,
      reset: true,
      hasMore: false,
      task,
      pendingDecision: null,
      usage: task.usage,
    });
    await until(
      () =>
        fixture.requests.filter(
          (req) => req.path === "/api/tasks/demo-verification",
        ).length === 2,
    );
    expect(projection.getSnapshot().task?.status).toBe("succeeded");
    expect(projection.getSnapshot().task?.verificationStatus).toBe("failed");
  });
  it("loads bounded earlier history and fetches large detail only on demand", async () => {
    await projection.select("demo-large");
    expect(projection.getSnapshot().task?.entries).toHaveLength(100);
    expect(projection.getSnapshot().olderAvailable).toBe(true);
    expect(
      fixture.requests.some((req) => req.path.includes("/api/details/")),
    ).toBe(false);
    await projection.loadEarlier();
    expect(projection.getSnapshot().task?.entries.length).toBeGreaterThan(130);
    expect(projection.getSnapshot().olderAvailable).toBe(false);
    await Promise.all([
      projection.loadDetail("demo-large-artifact"),
      projection.loadDetail("demo-large-artifact"),
    ]);
    expect(
      fixture.requests.filter(
        (req) => req.path === "/api/details/demo-large-artifact",
      ),
    ).toHaveLength(1);
    expect(
      projection.getSnapshot().details["demo-large-artifact"]?.data?.content
        .length,
    ).toBeGreaterThan(262144);
  });
  it("isolates delayed detail requests when switching A to B to A", async () => {
    fixture.delayDetails(100);
    await projection.select("demo-large");
    const old = projection.loadDetail("demo-large-artifact");
    await projection.select("demo-completed");
    await projection.select("demo-large");
    await projection.loadDetail("demo-large-artifact");
    await old;
    expect(
      projection.getSnapshot().details["demo-large-artifact"]?.data,
    ).toBeDefined();
    expect(
      fixture.requests.filter((req) =>
        req.path.includes("/api/details/demo-large-artifact"),
      ),
    ).toHaveLength(2);
  });
  it("displays acknowledged cancellation before stopped acknowledgement and sends explicit decisions", async () => {
    await projection.select("demo-running");
    projection.disconnect();
    await projection.cancel();
    expect(projection.getSnapshot().task?.status).toBe("cancel_requested");
    await projection.select("demo-decision");
    await projection.decide("approve");
    await until(() => projection.getSnapshot().task?.status === "succeeded");
    expect(
      fixture.requests.find((req) => req.path.endsWith("/decision"))?.body,
    ).toContain("approve");
  });
  it("settles an in-flight detail when going offline and resumes without a permanent loading state", async () => {
    fixture.delayDetails(100);
    await projection.select("demo-large");
    const loading = projection.loadDetail("demo-large-artifact");
    projection.setOnline(false);
    await loading;
    expect(projection.getSnapshot().connection).toBe("disconnected");
    expect(
      projection.getSnapshot().details["demo-large-artifact"]?.loading,
    ).not.toBe(true);
    expect(
      projection.getSnapshot().details["demo-large-artifact"]?.data,
    ).toBeDefined();
    projection.setOnline(true);
    await until(() => projection.getSnapshot().connection === "live");
  });
  it("keeps an in-flight task selection while offline and resumes after a failed snapshot", async () => {
    fixture.delaySnapshots(80);
    const selecting = projection.select("demo-large");
    projection.setOnline(false);
    await selecting;
    expect(projection.getSnapshot().task?.id).toBe("demo-large");
    expect(projection.getSnapshot().connection).toBe("disconnected");
    projection.setOnline(true);
    await until(() => projection.getSnapshot().connection === "live");
    fixture.loseSnapshotResponse();
    await projection.select("demo-completed");
    expect(projection.getSnapshot().task).toBeNull();
    projection.setOnline(false);
    projection.setOnline(true);
    await until(() => projection.getSnapshot().task?.id === "demo-completed");
  });
});
