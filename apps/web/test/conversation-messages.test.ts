import { describe, expect, it } from "vitest";
import type { ConversationTurn } from "@flow/contracts";
import { conversationMessages, messageTask, userMessageId } from "../src/conversations/messages";
import { replyDetailKey } from "../src/conversations/projection";
import { coreFixture, makeTurn, projectionFixture } from "./conversation-message-reuse.probe";

const pending = (turn: ConversationTurn): ConversationTurn => ({ ...turn, task: { ...turn.task, status: "running" }, assistant: { state: "pending", reason: "execution-pending" } });

describe("immutable conversation message projection", () => {
  it("shows fixed attachment metadata without copying body into the message or invalidating unchanged turns", () => {
    const turn = makeTurn();
    turn.context = { id: "context", contextDigest: "a".repeat(64), executionInputId: "input", executionInputDigest: "b".repeat(64), templateVersion: 2, order: "knowledge-then-attachments", sources: [], attachments: [{
      reference: { kind: "upload", projectId: "project-a", resourceId: "10000000-0000-4000-8000-000000000001", version: 1, contentDigest: "c".repeat(64) }, name: "note.txt", mediaType: "text/plain", byteLength: 5,
    }] };
    const before = conversationMessages([turn]);
    expect(before[0]?.attachments).toMatchObject([{ name: "note.txt · v1", content: [], status: { type: "complete" } }]);
    expect(before[0]?.content).toBe(turn.user.text); expect(conversationMessages([turn])[0]).toBe(before[0]);
  });

  it("reuses message objects after a real unchanged projection refresh while keeping a fresh ordered array", async () => {
    const fixture = projectionFixture([makeTurn(), makeTurn(2)]);
    try {
      await fixture.projection.refresh();
      const turns = fixture.projection.getSnapshot().turns;
      const before = conversationMessages(turns);
      await fixture.projection.refresh();
      const nextTurns = fixture.projection.getSnapshot().turns;
      expect(nextTurns).not.toBe(turns); expect(nextTurns[0]).toBe(turns[0]); expect(nextTurns[1]).toBe(turns[1]);
      const after = conversationMessages(nextTurns);
      expect(after).not.toBe(before); after.forEach((message, i) => expect(message).toBe(before[i]));
      expect(fixture.requests.details).toBe(0);
    } finally { fixture.projection.dispose(); }
  });

  it("updates same-revision pending replies and corrected final text without replacing another turn", async () => {
    const first = makeTurn(), second = makeTurn(2); const fixture = projectionFixture([first, pending(second)]);
    try {
      await fixture.projection.refresh(); const before = conversationMessages(fixture.projection.getSnapshot().turns);
      fixture.replace([first, second]); await fixture.projection.refresh();
      const final = conversationMessages(fixture.projection.getSnapshot().turns);
      expect(fixture.projection.getSnapshot().snapshot?.conversation.revision).toBe(2);
      expect(final).toHaveLength(4); expect(final[0]).toBe(before[0]); expect(final[1]).toBe(before[1]);
      expect(final[3]?.content).toContainEqual({ type: "text", text: "Reply 2" });
      fixture.replace([first, makeTurn(2, "Corrected at same revision")]); await fixture.projection.refresh();
      const corrected = conversationMessages(fixture.projection.getSnapshot().turns);
      expect(corrected[1]).toBe(final[1]); expect(corrected[3]).not.toBe(final[3]);
      expect(corrected[3]?.content).toContainEqual({ type: "text", text: "Corrected at same revision" });
      expect(fixture.requests.details).toBe(0);
    } finally { fixture.projection.dispose(); }
  });

  it("does not key reuse by text or revision when a truncated reply's source changes", async () => {
    const turn = makeTurn(); const fixture = projectionFixture([turn]);
    try {
      await fixture.projection.refresh(); const beforeTurn = fixture.projection.getSnapshot().turns[0]!;
      const before = conversationMessages([beforeTurn]); const key = replyDetailKey("conversation-1", beforeTurn);
      const next = structuredClone(turn);
      if (next.assistant.state !== "available" || next.assistant.source.kind !== "adapter-final-artifact") throw Error("fixture");
      next.assistant.source.artifactVersion = "v2";
      fixture.replace([next]); await fixture.projection.refresh();
      const afterTurn = fixture.projection.getSnapshot().turns[0]!; const after = conversationMessages([afterTurn]);
      expect(replyDetailKey("conversation-1", afterTurn)).not.toBe(key);
      expect(after[1]).not.toBe(before[1]); expect(after[1]?.content).toEqual(before[1]?.content);
      expect(after[1]?.content).toContainEqual({ type: "data", name: "flow-reply-detail", data: { turnId: turn.id } });
      const complete = structuredClone(next); if (complete.assistant.state === "available") complete.assistant.truncated = false;
      fixture.replace([complete]); await fixture.projection.refresh();
      expect(conversationMessages(fixture.projection.getSnapshot().turns)[1]?.content).toEqual([{ type: "text", text: "Reply 1" }]);
      expect(fixture.requests.details).toBe(0);
    } finally { fixture.projection.dispose(); }
  });

  it("preserves loaded message identities when a middle history gap is filled", async () => {
    const turns = Array.from({ length: 25 }, (_, i) => makeTurn(i + 1)); const fixture = projectionFixture(turns);
    try {
      await fixture.projection.refresh(); const before = new Map(conversationMessages(fixture.projection.getSnapshot().turns).map(message => [message.id, message]));
      fixture.projection.setVisible(true);
      await fixture.projection.loadMore(); const loaded = fixture.projection.getSnapshot().turns; const after = conversationMessages(loaded);
      expect(loaded.map(turn => turn.number)).toEqual(turns.map(turn => turn.number)); expect(after).toHaveLength(50);
      for (const message of after) if (before.has(message.id)) expect(message).toBe(before.get(message.id));
      expect(after.map(message => message.id)).toEqual(turns.flatMap(turn => [userMessageId(turn), turn.assistant.state === "available" ? turn.assistant.messageId : ""]));
    } finally { fixture.projection.dispose(); }
  });

  it("isolates same-ID turns from another connection and exposes only accepted message content", async () => {
    const a = projectionFixture([makeTurn(1, "Center A")]), b = projectionFixture([makeTurn(1, "Center B")]);
    try {
      await a.projection.refresh(); await b.projection.refresh();
      const one = conversationMessages(a.projection.getSnapshot().turns), two = conversationMessages(b.projection.getSnapshot().turns);
      expect(two[0]).not.toBe(one[0]); expect(two[1]).not.toBe(one[1]); expect(two[1]?.content).toContainEqual({ type: "text", text: "Center B" });
      const turn = b.projection.getSnapshot().turns[0]!;
      expect(messageTask([turn], userMessageId(turn))).toBe(turn.task.id); expect(messageTask([turn], "foreign-message")).toBeNull();
      b.projection.outbox.begin({ conversationId: "conversation-1", expectedRevision: 1, text: "Unacknowledged message" });
      expect(conversationMessages(b.projection.getSnapshot().turns)).toEqual(two);
      expect(JSON.stringify(two)).not.toMatch(/Unacknowledged|Execution details|verificationStatus/);
    } finally { a.projection.dispose(); b.projection.dispose(); }
  });

  it("preserves dates and excludes pending/unavailable telemetry, without mutating inputs", () => {
    const turn = pending(makeTurn()); Object.freeze(turn.user); Object.freeze(turn.assistant); Object.freeze(turn);
    const unavailable: ConversationTurn = { ...turn, assistant: { state: "unavailable", reason: "missing-result" } };
    const messages = conversationMessages([turn, unavailable]);
    expect(messages).toHaveLength(2); expect(messages.every(message => message.role === "user")).toBe(true);
    expect(messages[0]?.createdAt).toEqual(new Date(turn.createdAt)); expect(messages[0]?.content).toBe(turn.user.text);
  });

  it("allows actual core tail auto-status updates and preserves a draft through refreshes", async () => {
    const input = makeTurn(); const messages = conversationMessages([input]); const core = await coreFixture(messages);
    expect(core.takeCalls()).toBe(2); const before = core.thread.messages;
    core.thread.composer.setText("Draft stays separate");
    core.update(conversationMessages([input])); expect(core.takeCalls()).toBe(0);
    expect(core.thread.messages[0]).toBe(before[0]); expect(core.thread.messages[1]).toBe(before[1]);
    core.update(conversationMessages([input]), { isRunning: true }); expect(core.takeCalls()).toBe(1); expect(core.thread.messages.at(-1)?.status?.type).toBe("running");
    core.update(conversationMessages([input]), { isRunning: false }); expect(core.takeCalls()).toBe(1); expect(core.thread.messages.at(-1)?.status?.type).toBe("complete");
    expect(core.thread.composer.text).toBe("Draft stays separate");
  });

  it("keeps changed task facts and replacement adapter callbacks effective", async () => {
    const turn = makeTurn(); const changed: ConversationTurn = { ...turn, task: { ...turn.task, status: "failed", verificationStatus: "failed" } };
    const before = conversationMessages([turn]), after = conversationMessages([changed]);
    expect(after[1]).not.toBe(before[1]); expect(after[1]?.content).toEqual(before[1]?.content);
    const core = await coreFixture(before); const sent: string[] = [];
    core.thread.composer.setText("Next draft"); core.update(after, { isSendDisabled: true });
    expect(core.thread.composer.canSend).toBe(false);
    core.update(after, { isSendDisabled: false, onNew: async message => { sent.push(message.content.filter(part => part.type === "text").map(part => part.text).join("")); } });
    await core.thread.composer.send({ startRun: false });
    expect(sent).toEqual(["Next draft"]); expect(core.thread.messages).toHaveLength(2);
  });
});
