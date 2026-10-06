import { setTimeout as sleep } from 'node:timers/promises';
import { FlowClient } from '@flow/client';
import type { ClaimedTask, DecisionAnswer, Ownership } from '@flow/contracts';
import type { RunnerOptions } from './runtime.js';

export class AttemptInterrupted extends Error {
  constructor(readonly reason: 'cancel' | 'lost' | 'shutdown') { super(`Attempt interrupted: ${reason}`); }
}

export interface LeaseGrant { remainingLeaseMs: number; requestedAt: number }

export class AttemptControl {
  private readonly abort = new AbortController();
  readonly signal: AbortSignal;
  readonly ownership: Ownership;
  reason: AttemptInterrupted['reason'] | undefined;
  private heartbeatInFlight: Promise<void> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private decisions = new Map<string, DecisionAnswer['answer']>();
  private closed = false;
  private deadline = 0;
  private readonly onShutdown = () => this.close();

  constructor(private assignment: ClaimedTask, private client: FlowClient, private options: RunnerOptions, initialLease: LeaseGrant) {
    this.ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
    this.signal = AbortSignal.any([this.abort.signal, options.signal]);
    if (options.signal.aborted) { this.close(); return; }
    options.signal.addEventListener('abort', this.onShutdown, { once: true });
    this.renew(initialLease.remainingLeaseMs, initialLease.requestedAt);
    if (!this.reason) this.interval = setInterval(() => { void this.heartbeat().catch(() => undefined); }, options.heartbeatIntervalMs ?? 2000);
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
    clearInterval(this.interval);
    clearTimeout(this.expiry);
    this.abort.abort(new AttemptInterrupted(reason));
    if (reason === 'lost') this.options.onNotice?.({ type: 'ownership-lost', attemptId: this.assignment.attempt.id });
  }

  close() {
    this.closed = true;
    this.options.signal.removeEventListener('abort', this.onShutdown);
    clearInterval(this.interval);
    clearTimeout(this.expiry);
    this.abort.abort();
  }

  private assertActive() {
    if (this.options.signal.aborted || this.closed) throw new AttemptInterrupted('shutdown');
    if (!this.reason && performance.now() >= this.deadline) this.interrupt('lost');
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
        this.renew(response.remainingLeaseMs, started);
        if (response.decision) this.decisions.set(response.decision.decisionId, response.decision.answer);
      } else this.interrupt('lost');
    } catch (error) {
      if (this.closed) return;
      if (!(error instanceof AttemptInterrupted)) this.interrupt('lost');
    }
    this.assertActive();
  }

  private renew(remainingLeaseMs: number, requestedAt: number) {
    if (this.closed || this.reason || this.options.signal.aborted) return;
    clearTimeout(this.expiry);
    this.deadline = requestedAt + remainingLeaseMs;
    const remaining = this.deadline - performance.now();
    if (!Number.isSafeInteger(remainingLeaseMs) || remainingLeaseMs < 1 || remainingLeaseMs > 300_000 || !Number.isFinite(remaining) || remaining <= 0) {
      this.interrupt('lost'); return;
    }
    this.expiry = setTimeout(() => this.interrupt('lost'), remaining);
  }
}
