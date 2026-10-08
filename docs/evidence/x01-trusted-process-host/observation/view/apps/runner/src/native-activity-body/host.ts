import { FlowApiError } from '@flow/client';
import type { EventBatch } from '../../../../packages/contracts/src/runner.js';
import {
  nativeActivityBodySupportSchema, NATIVE_ACTIVITY_BODY_PROTOCOL,
  type NativeActivityBodyInput, type NativeActivityBodyPublisher,
} from '../../../../packages/contracts/src/native-activity-body.js';

export type BodySupportReader = (signal: AbortSignal) => Promise<unknown>;

/** Feature-specific confirmation, not an authority grant or another sender. */
export class NativeActivityBodyHost {
  constructor(private readonly readSupport: BodySupportReader) {}

  /** Call before new admission, outside execute's ordinary failed-settlement catch. */
  async beforeAdmission(enabled: boolean, runnerId: string, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();
    return enabled ? this.confirm(runnerId, signal) : false;
  }

  /** Existing durable bodies still require confirmation when new publishing is disabled. */
  async beforeReport(batch: EventBatch, runnerId: string, signal: AbortSignal): Promise<void> {
    if (batch.events.some(event => event.type === 'native-activity-body')) await this.requireSupport(runnerId, signal);
  }

  async publisher(input: {
    runnerId: string;
    signal: AbortSignal;
    assertOwnership(): Promise<void>;
    publish(material: NativeActivityBodyInput): Promise<void>;
    lost(): void;
  }): Promise<NativeActivityBodyPublisher> {
    // Once claimed, confirmation failure is conservative lost, never a fabricated failed model run.
    try { await this.requireSupport(input.runnerId, input.signal); }
    catch (error) { input.lost(); throw error; }
    return Object.freeze({
      protocol: NATIVE_ACTIVITY_BODY_PROTOCOL,
      publish: async (material: NativeActivityBodyInput) => {
        await input.assertOwnership();
        input.signal.throwIfAborted();
        // The original outbox owns staging/ordering. Its report callback confirms each body batch.
        return input.publish(material);
      },
    });
  }

  private async requireSupport(runnerId: string, signal: AbortSignal): Promise<void> {
    if (!await this.confirm(runnerId, signal)) throw new Error('The center cannot currently confirm durable body support; original materials are retained.');
  }

  private async confirm(runnerId: string, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();
    try {
      const support = nativeActivityBodySupportSchema.parse(await this.readSupport(signal));
      signal.throwIfAborted();
      if (support.runnerId !== runnerId) throw new Error('Body support belongs to another runner identity.');
      return true;
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof FlowApiError && (error.status === 404 || error.status === 501)) return false;
      throw error;
    }
  }
}
