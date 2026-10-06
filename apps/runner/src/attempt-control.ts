import { setTimeout as sleep } from 'node:timers/promises';
import { FlowClient } from '@flow/client';
import type { ClaimedTask, DecisionAnswer, Ownership } from '@flow/contracts';
import type { RunnerOptions } from './runtime.js';

export class AttemptInterrupted extends Error {
  constructor(readonly reason: 'cancel' | 'lost' | 'shutdown') { super(`Attempt interrupted: ${reason}`); }
}

export class AttemptControl {
  private readonly abort = new AbortController();
  readonly signal: AbortSignal;
  readonly ownership: Ownership;
  reason: AttemptInterrupted['reason'] | undefined;
  private heartbeatInFlight: Promise<void> | undefined;
  private interval: ReturnType<typeof setInterval>;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private decisions = new Map<string, DecisionAnswer['answer']>();
  private closed = false;

  constructor(private assignment: ClaimedTask, private client: FlowClient, private options: RunnerOptions) {
    this.ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
    this.signal = AbortSignal.any([this.abort.signal, options.signal]);
    this.renew(assignment.attempt.leaseExpiresAt, performance.now());
    this.interval = setInterval(() => { void this.heartbeat().catch(() => undefined); }, options.heartbeatIntervalMs ?? 2000);
  }

  async assertOwnership() {
    this.assertActive();
    await this.heartbeat();
    this.assertActive();
  }

  async answer(decisionId: string): Promise<DecisionAnswer['answer']> {
    while (!this.decisions.has(decisionId)) {
      this.assertActive();
      await sleep(20, undefined, { signal: this.signal }).catch(() => this.assertActive());
    }
    await this.assertOwnership();
    return this.decisions.get(decisionId)!;
  }

  interrupt(reason: AttemptInterrupted['reason']) {
    if (this.reason || this.options.signal.aborted) return;
    this.reason = reason;
    this.abort.abort(new AttemptInterrupted(reason));
    if (reason === 'lost') this.options.onNotice?.({ type: 'ownership-lost', attemptId: this.assignment.attempt.id });
  }

  close() {
    this.closed = true;
    clearInterval(this.interval);
    clearTimeout(this.expiry);
    this.abort.abort();
  }

  private assertActive() {
    if (this.options.signal.aborted) throw new AttemptInterrupted('shutdown');
    if (this.reason) throw new AttemptInterrupted(this.reason);
  }

  private heartbeat(): Promise<void> {
    if (this.heartbeatInFlight) return this.heartbeatInFlight;
    this.heartbeatInFlight = this.checkHeartbeat().finally(() => { this.heartbeatInFlight = undefined; });
    return this.heartbeatInFlight;
  }

  private async checkHeartbeat() {
    if (this.closed) return;
    this.assertActive();
    const started = performance.now();
    try {
      const signal = AbortSignal.any([this.signal, AbortSignal.timeout(this.options.requestTimeoutMs ?? 1500)]);
      const response = await this.client.heartbeat(this.ownership, signal);
      if (this.closed) return;
      this.assertActive();
      if (response.action === 'cancel') this.interrupt('cancel');
      else if (response.action === 'stop') this.interrupt('lost');
      else if (response.action === 'continue') {
        this.renew(response.leaseExpiresAt, started);
        if (response.decision) this.decisions.set(response.decision.decisionId, response.decision.answer);
      } else this.interrupt('lost');
    } catch (error) {
      if (this.closed) return;
      if (!(error instanceof AttemptInterrupted)) this.interrupt('lost');
    }
    this.assertActive();
  }

  private renew(leaseExpiresAt: string, started: number) {
    clearTimeout(this.expiry);
    const remaining = Math.min(Date.parse(leaseExpiresAt) - Date.now(), 10_000 - (performance.now() - started));
    if (!Number.isFinite(remaining) || remaining <= 0) { this.interrupt('lost'); return; }
    this.expiry = setTimeout(() => this.interrupt('lost'), remaining);
  }
}
