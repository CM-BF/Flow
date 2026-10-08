export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type RequestId = number | string;
export type Delivery = 'not-sent' | 'unknown' | 'remote-error';
export type ErrorCode = 'INVALID_OPTIONS' | 'NOT_READY' | 'CLOSED' | 'ABORTED' | 'TIMEOUT' | 'LIMIT' | 'PROTOCOL' | 'DISCONNECTED' | 'SPAWN_FAILED' | 'WRITE_FAILED' | 'REMOTE_ERROR' | 'CONCURRENT_RECEIVE';

/** Fixed diagnostic fields only: no child stderr, remote error message/data, or environment. */
export class CodexTransportError extends Error {
  constructor(readonly code: ErrorCode, readonly delivery: Delivery, readonly rpcCode?: number) {
    super(`Codex transport: ${code} (${delivery})`);
    this.name = 'CodexTransportError';
  }
}
export interface ReadyInfo { userAgent: string; platformFamily: string; platformOs: string }
export type Inbound = { kind: 'notification'; method: string; params: Json }
  | { kind: 'server-request'; id: RequestId; method: string; params: Json };
export type Reply = { result: Json } | { error: { code: number; message: string } };
export interface Limits {
  frameBytes: number; outboundBytes: number; outboundFrames: number;
  inboundBytes: number; inboundFrames: number; pendingRequests: number; serverRequests: number;
  requestTimeoutMs: number; initializeTimeoutMs: number; terminateMs: number; killMs: number;
}
/** Trusted host only. Must return undefined synchronously; async/thenable results fail observation. */
export interface PrivateStderrSink { maxBytes: number; write: (chunk: Uint8Array) => unknown }
export interface StderrCaptureReport {
  observedBytes: number; writtenBytes: number; truncated: boolean; observerFailed: boolean;
  streamEnded: boolean; childCloseObserved: boolean; incomplete: boolean;
}
export interface TransportOptions {
  spawn: { executable: string; args: string[]; cwd: string; environment: Record<string, string> };
  initialize: {
    clientInfo: { name: string; title: string | null; version: string };
    capabilities: null | { experimentalApi: boolean; requestAttestation: boolean; optOutNotificationMethods?: string[] };
  };
  limits?: Partial<Limits>;
  signal?: AbortSignal;
  privateStderr?: PrivateStderrSink;
}
export interface CloseReport {
  reason: ErrorCode; child: 'confirmed-exited' | 'unconfirmed';
  exitCode: number | null; signal: NodeJS.Signals | null; remoteEffects: 'unknown';
  stderrCapture?: StderrCaptureReport;
}
export interface TransportSnapshot {
  state: 'starting' | 'ready' | 'closing' | 'closed'; pid: number | null;
  pendingRequests: number; unansweredRequests: number; serverRequests: number; inboundBytes: number; inboundFrames: number;
  outboundBytes: number; outboundFrames: number; peakInboundBytes: number; peakOutboundBytes: number;
  stderrBytes: number; ignoredResponses: number;
}
export interface CodexTransport {
  readonly ready: Promise<ReadyInfo>;
  readonly closed: Promise<CloseReport>;
  request(method: string, params: Json, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<Json>;
  receive(): Promise<Inbound | null>;
  respond(id: RequestId, reply: Reply): Promise<void>;
  close(): Promise<CloseReport>;
  snapshot(): TransportSnapshot;
}
