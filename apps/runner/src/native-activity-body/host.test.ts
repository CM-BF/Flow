import { expect, it, vi } from 'vitest';
import { FlowApiError } from '@flow/client';
import { NATIVE_ACTIVITY_BODY_LIMITS, type NativeActivityBodyInput } from '../../../../packages/contracts/src/native-activity-body.js';
import type { EventBatch } from '../../../../packages/contracts/src/runner.js';
import { NativeActivityBodyHost } from './host.js';

const support = () => ({ protocol: 'native-activity-body-v1', representation: 'sdk-public-material-utf8-v1', runnerId: 'runner', limits: { ...NATIVE_ACTIVITY_BODY_LIMITS } });
const signal = () => new AbortController().signal;
const bodyBatch: EventBatch = { attemptId: 'attempt', ownerVersion: 1, events: [{ id: 'event', sequence: 1, type: 'native-activity-body', protocol: 'native-activity-body-v1', action: 'seal', activityId: 'a'.repeat(64), nativeSessionId: 'session', bytes: 0, sha256: 'b'.repeat(64) }] };

it('defaults to legacy without a support read, and only explicit old-center replies select legacy', async () => {
  const read = vi.fn().mockResolvedValue(support()), host = new NativeActivityBodyHost(read);
  expect(await host.beforeAdmission(false, 'runner', signal())).toBe(false); expect(read).not.toHaveBeenCalled();
  for (const status of [404, 501]) {
    read.mockRejectedValueOnce(new FlowApiError(status, 'missing', 'Unsupported'));
    expect(await host.beforeAdmission(true, 'runner', signal())).toBe(false);
  }
  expect(await host.beforeAdmission(true, 'runner', signal())).toBe(true);
});

it('never turns malformed, wrong runner, changed limits, auth or network errors into a new-admission grant', async () => {
  const values = [{}, { ...support(), runnerId: 'other' }, { ...support(), limits: { ...NATIVE_ACTIVITY_BODY_LIMITS, bodyBytes: 1 } }];
  for (const value of values) await expect(new NativeActivityBodyHost(async () => value).beforeAdmission(true, 'runner', signal())).rejects.toThrow();
  for (const error of [new FlowApiError(401, 'auth', 'Denied'), new Error('Connection lost')]) {
    await expect(new NativeActivityBodyHost(async () => { throw error; }).beforeAdmission(true, 'runner', signal())).rejects.toBe(error);
  }
});

it('requires current support for every durable body report and leaves legacy report paths alone', async () => {
  const read = vi.fn().mockResolvedValueOnce(support()).mockRejectedValue(new FlowApiError(404, 'missing', 'Old center'));
  const host = new NativeActivityBodyHost(read);
  await host.beforeReport({ ...bodyBatch, events: [] }, 'runner', signal()); expect(read).not.toHaveBeenCalled();
  await host.beforeReport(bodyBatch, 'runner', signal());
  await expect(host.beforeReport(bodyBatch, 'runner', signal())).rejects.toThrow('retained');
  expect(read).toHaveBeenCalledTimes(2);
});

it('marks post-claim confirmation unknown as lost before any publisher or model invocation', async () => {
  const host = new NativeActivityBodyHost(async () => { throw new Error('lost'); });
  const lost = vi.fn(), publish = vi.fn(), assertOwnership = vi.fn();
  await expect(host.publisher({ runnerId: 'runner', signal: signal(), lost, publish, assertOwnership })).rejects.toThrow('lost');
  expect(lost).toHaveBeenCalledOnce(); expect(publish).not.toHaveBeenCalled(); expect(assertOwnership).not.toHaveBeenCalled();
});

it('reuses the original outbox publisher after ownership and propagates storage failure unchanged', async () => {
  const order: string[] = [], failure = new Error('durable write failed');
  const host = new NativeActivityBodyHost(async () => support());
  const publish = vi.fn(async (_input: NativeActivityBodyInput) => { order.push('outbox'); throw failure; });
  const port = await host.publisher({ runnerId: 'runner', signal: signal(), lost: vi.fn(), assertOwnership: async () => { order.push('ownership'); }, publish });
  const material: NativeActivityBodyInput = { content: new Uint8Array(), activity: { type: 'native-activity', activityId: 'a'.repeat(64), nativeSessionId: 'session', source: 'claude.sdk.message', sourceMessageId: 'message', nativeMessageId: null, blockIndex: 0, parentToolUseId: null, kind: 'tool', phase: 'input-ready', toolUseId: 'tool', toolName: 'read', body: null } };
  await expect(port.publish(material)).rejects.toBe(failure); expect(order).toEqual(['ownership', 'outbox']); expect(publish).toHaveBeenCalledOnce();
});
