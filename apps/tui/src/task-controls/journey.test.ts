import { afterAll, beforeAll, expect, test } from 'vitest';
import { CancelJourney } from './fixture.js';

let journey: CancelJourney | undefined;
let taskB: string | undefined;
beforeAll(async () => {
  const directory = process.env.FLOW_TUI01F_EVIDENCE_DIR;
  if (!directory) throw Error('Set a fresh absolute FLOW_TUI01F_EVIDENCE_DIR; this suite starts one isolated PG/HTTP/PTY lifetime');
  journey = new CancelJourney(directory); await journey.start();
});
afterAll(async () => { await journey?.close(); });

test('accepted cancellation loses its ACK; journal reopening recovers original A after public client admits B', async () => {
  const f = journey!; let terminal: Awaited<ReturnType<CancelJourney['terminal']>> | undefined;
  try {
    const taskA = await f.admit('A'); f.dropFirstAckFor(taskA);
    terminal = await f.terminal('durable-A');
    expect((await terminal.controller.input(`/open ${f.conversationId}`)).code).toBe('OPENED');
    terminal.controller.setDraft('保留原草稿🙂\nnot submitted');
    expect((await terminal.controller.input(`/cancel ${taskA}`)).code).toBe('UNKNOWN');
    const original = await terminal.journal.load();
    expect(original).toMatchObject({ kind: 'task-cancel', taskId: taskA, input: {} });
    expect(terminal.controller.snapshot().draft).toBe('保留原草稿🙂\nnot submitted');
    await f.waitTask(taskA, 'cancelled');
    await terminal.close(); terminal = undefined;
    taskB = await f.admit('B'); // A's persisted session is reused only through the public admission path.
    terminal = await f.terminal('durable-A');
    expect(f.requests).toHaveLength(1); expect(await terminal.journal.load()).toEqual(original);
    expect((await terminal.controller.input('/recover')).code).toBe('ACCEPTED');
    expect(f.requests).toHaveLength(2);
    expect(f.requests.map(({ path, key, body }) => ({ path, key, body }))).toEqual([
      { path: `/api/tasks/${taskA}/cancel`, key: original!.key, body: '{}' },
      { path: `/api/tasks/${taskA}/cancel`, key: original!.key, body: '{}' },
    ]);
    expect(f.requests[0]).toMatchObject({ dropped: true, upstreamStatus: 200 });
    expect(f.requests[1]).toMatchObject({ dropped: false, upstreamStatus: 200 });
    expect(await terminal.journal.load()).toBeNull();
    expect(terminal.controller.snapshot().turns.at(-1)).toMatchObject({ taskId: taskB, status: 'running' });
    expect((await f.client.show(taskB)).status).toBe('running');
    f.record('lostAck', { original, resumedTaskId: taskB, requests: f.requests, journalCleared: true, reopeningSentNothing: true });
  } catch (error) { f.failed('lost-ack-scenario'); throw error; }
  finally { await terminal?.close(); }
});

test('actual PTY cancels B, observes C, preserves a narrow multiline draft and quits without cancelling C', async () => {
  const f = journey!;
  try {
    if (!taskB) throw Error('First lifecycle scenario must establish B; no substitute tasks');
    let taskC: string | undefined;
    const pty = await f.pty(taskB, async signal => {
      await f.waitTask(taskB!, 'cancelled', signal);
      taskC = await f.admit('C', signal); return taskC;
    });
    expect(pty).toMatchObject({ exitCode: 0, rawModeRestored: true, resized: [60, 20], unsentCjkMultilineDraft: true });
    expect(taskC).toBeDefined(); expect(f.requests).toHaveLength(3);
    expect(f.requests[2]).toMatchObject({ taskId: taskB, body: '{}', dropped: false, upstreamStatus: 200 });
    expect(f.requests.filter(request => request.taskId === taskC)).toHaveLength(0);
    expect((await f.client.show(taskC!)).status).toBe('running');
    const turns = await f.client.conversationTurns(f.conversationId);
    expect(turns.turns.map(turn => turn.task.id)).toEqual(f.tasks);
    expect(turns.turns).toHaveLength(3);
    f.release(taskC!); await f.waitTask(taskC!, 'succeeded');
    const statuses = await Promise.all(f.tasks.map(async id => (await f.client.show(id)).status));
    expect(statuses).toEqual(['cancelled', 'cancelled', 'succeeded']);
    f.record('ptyExit', { pty, statuses, noCPost: true, onlyThreeTurns: true, cWasRunningAfterExit: true });
  } catch (error) { f.failed('pty-scenario'); throw error; }
}, 30_000);
