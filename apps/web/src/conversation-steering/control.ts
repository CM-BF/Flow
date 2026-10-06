import { FlowApiError } from "@flow/client";
import { idSchema, steeringCommandSchema, MAX_STEERING_COMMANDS_PER_ATTEMPT, type SteeringAdmission, type SteeringCommandInput, type SteeringCommandReference, type SteeringCommandResult, type SteeringState } from "@flow/contracts";

export const STEERING_LIMITS = Object.freeze({ receipts: 8, attempts: 4, page: 20, timeoutMs: 15_000 });
export interface SteeringIdentity { connectionScope: string; taskId: string }
export interface SteeringPort {
  admission(options: { attemptId?: string }, signal: AbortSignal): Promise<SteeringAdmission>;
  state(options: { attemptId: string; after: number; limit: number }, signal: AbortSignal): Promise<SteeringState>;
  accept(input: SteeringCommandInput, key: string, signal: AbortSignal): Promise<SteeringCommandResult>;
}
export interface SteeringGate { visible: boolean; online: boolean; authorized: boolean }
export interface LocalSteeringReceipt {
  readonly key: string;
  readonly input: Readonly<SteeringCommandInput>;
  readonly bytes: number;
  readonly digest: string;
  readonly phase: "sending" | "unknown" | "accepted" | "rejected";
  readonly everUnknown: boolean;
  readonly command?: SteeringCommandReference;
  readonly error?: string;
}
export interface SteeringSnapshot extends SteeringGate {
  readonly identity: Readonly<SteeringIdentity>;
  readonly admission?: SteeringAdmission;
  readonly commands: readonly SteeringCommandReference[];
  readonly receipts: readonly LocalSteeringReceipt[];
  readonly loading: boolean;
  readonly preparing: boolean;
  readonly stale: boolean;
  readonly loadedAt?: string;
  readonly nextCursor: number | null;
  readonly error?: string;
  readonly sendDisabledReason?: string;
}
export interface SteeringControl {
  getSnapshot(): SteeringSnapshot;
  subscribe(listener: () => void): () => void;
  updateGate(gate: SteeringGate): void;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  /** Resolves after the frozen local handoff. It does not await or attest center acceptance. */
  submit(text: string): Promise<boolean>;
  retry(key: string): boolean;
  clearResolved(): void;
  dispose(): void;
}

const statuses = ["accepted", "received", "observed-consumed", "rejected", "unknown"] as const;
const reasons = ["disabled", "not-installed", "no-attempt", "not-current", "stale-owner", "not-running", "decision-pending", "lease-expired", "runner-revoked", "session-unavailable", "profile-unsupported", "profile-unavailable", "final-exists", "sealed", "pending", "unknown-pending", "limit-reached"] as const;
function invalid(): never { throw Error("The center returned invalid or mismatched steering data."); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function id(value: unknown): string { const parsed = idSchema.safeParse(value); return parsed.success ? parsed.data : invalid(); }
function integer(value: unknown, min = 0): number { return typeof value === "number" && Number.isInteger(value) && value >= min && value <= 2_147_483_647 ? value : invalid(); }
function boolean(value: unknown): boolean { return typeof value === "boolean" ? value : invalid(); }
function digest(value: unknown): string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : invalid(); }
function date(value: unknown): string { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : invalid(); }
function member<T extends string>(values: readonly T[], value: unknown): T { return typeof value === "string" && values.includes(value as T) ? value as T : invalid(); }
function admission(value: unknown, taskId: string): SteeringAdmission {
  const r = object(value); if (id(r.taskId) !== taskId) invalid();
  if (r.state === "ready" && r.reason === "ready") return Object.freeze({ taskId, state: "ready", reason: "ready", attemptId: id(r.attemptId), ownerVersion: integer(r.ownerVersion, 1), revision: integer(r.revision) });
  if (r.state !== "unavailable") invalid();
  return Object.freeze({ taskId, state: "unavailable", reason: member(reasons, r.reason), attemptId: r.attemptId === null ? null : id(r.attemptId), ownerVersion: r.ownerVersion === null ? null : integer(r.ownerVersion, 1), revision: r.revision === null ? null : integer(r.revision) });
}
function reference(value: unknown, taskId: string, attemptId: string): SteeringCommandReference {
  const r = object(value), input = object(r.input);
  if (id(r.taskId) !== taskId || id(r.attemptId) !== attemptId || typeof r.userMessageUuid !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(r.userMessageUuid)) invalid();
  const bytes = integer(input.bytes, 1); if (bytes > 16_384) invalid();
  return Object.freeze({ id: id(r.id), taskId, attemptId, ownerVersion: integer(r.ownerVersion, 1), nativeSessionId: id(r.nativeSessionId), revision: integer(r.revision, 1), userMessageUuid: r.userMessageUuid,
    status: member(statuses, r.status), receiptRevision: integer(r.receiptRevision), input: Object.freeze({ bytes, digest: digest(input.digest) }), createdAt: date(r.createdAt), updatedAt: date(r.updatedAt) });
}
function sameCommand(a: SteeringCommandReference, b: SteeringCommandReference): boolean {
  return a.id === b.id && a.taskId === b.taskId && a.attemptId === b.attemptId && a.ownerVersion === b.ownerVersion && a.nativeSessionId === b.nativeSessionId && a.revision === b.revision && a.userMessageUuid === b.userMessageUuid && a.input.bytes === b.input.bytes && a.input.digest === b.input.digest && a.createdAt === b.createdAt;
}
function mergeReference(old: SteeringCommandReference | undefined, next: SteeringCommandReference): SteeringCommandReference {
  if (!old) return next;
  if (!sameCommand(old, next)) invalid();
  if (old.receiptRevision > next.receiptRevision) return old;
  if (old.receiptRevision === next.receiptRevision) { if (old.status !== next.status || old.updatedAt !== next.updatedAt) invalid(); return old; }
  return next;
}
function mergeCommand(into: Map<string, SteeringCommandReference>, command: SteeringCommandReference): SteeringCommandReference {
  for (const known of into.values()) if (known.attemptId === command.attemptId) {
    if (known.nativeSessionId !== command.nativeSessionId || (known.revision === command.revision && known.id !== command.id)) invalid();
  }
  const merged = mergeReference(into.get(command.id), command);
  into.set(command.id, merged);
  return merged;
}
function resolved(status: SteeringCommandReference["status"]): boolean { return status === "observed-consumed" || status === "rejected"; }
async function textDigest(text: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function request<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return read(); }).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function message(error: unknown): string { return error instanceof Error ? error.message : "Steering request failed."; }
function rejection(error: unknown): boolean { return error instanceof FlowApiError && [400, 401, 403, 404, 409, 422].includes(error.status) && !error.code.includes("idempotency"); }

class Control implements SteeringControl {
  private gate: SteeringGate = { visible: false, online: true, authorized: false };
  private listeners = new Set<() => void>();
  private commands = new Map<string, SteeringCommandReference>();
  private receipts = new Map<string, LocalSteeringReceipt>();
  private pages = new Map<string, { count: number; next: number | null }>();
  private current?: SteeringAdmission;
  private loadedAt?: string;
  private error?: string;
  private stale = false;
  private preparing = false;
  private reading?: AbortController;
  private sending?: { key: string; controller: AbortController };
  private generation = 0;
  private disposed = false;
  private snapshot: SteeringSnapshot;
  constructor(private readonly identity: Readonly<SteeringIdentity>, private readonly port: SteeringPort) { this.snapshot = this.build(); }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private allowed() { return !this.disposed && this.gate.visible && this.gate.online && this.gate.authorized; }
  private attempts() { return new Set([...this.pages.keys(), ...[...this.commands.values()].map(r => r.attemptId), ...[...this.receipts.values()].map(r => r.input.attemptId)]); }
  private reason(): string | undefined {
    if (this.disposed || !this.gate.authorized) return "Steering is not authorized in this view.";
    if (!this.gate.visible || !this.gate.online) return "Reconnect and open steering before sending.";
    if (this.preparing || this.sending) return "A steering handoff is in progress.";
    if (this.receipts.size >= STEERING_LIMITS.receipts) return "Local receipt capacity reached. Clear resolved receipts; unresolved receipts are retained.";
    if (this.stale || !this.current) return "Refresh steering availability before sending.";
    if (this.current.state !== "ready") return `Steering unavailable: ${this.current.reason.replaceAll("-", " ")}.`;
    if (!this.attempts().has(this.current.attemptId) && this.attempts().size >= STEERING_LIMITS.attempts) return "Local attempt history is full. Clear resolved history before sending.";
    return undefined;
  }
  private build(): SteeringSnapshot {
    return Object.freeze({ ...this.gate, identity: this.identity, admission: this.current, commands: Object.freeze([...this.commands.values()]), receipts: Object.freeze([...this.receipts.values()]), loading: !!this.reading, preparing: this.preparing, stale: this.stale, loadedAt: this.loadedAt, error: this.error,
      nextCursor: this.current?.attemptId ? this.pages.get(this.current.attemptId)?.next ?? null : null, sendDisabledReason: this.reason() });
  }
  private publish() { this.snapshot = this.build(); for (const listener of this.listeners) listener(); }
  updateGate(gate: SteeringGate) {
    if (this.disposed || Object.keys(gate).every(key => gate[key as keyof SteeringGate] === this.gate[key as keyof SteeringGate])) return;
    this.gate = { ...gate };
    if (!this.allowed()) {
      this.generation++; this.reading?.abort(); this.reading = undefined; this.preparing = false; this.stale = !!this.current;
      if (this.sending) {
        const receipt = this.receipts.get(this.sending.key)!;
        this.receipts.set(receipt.key, Object.freeze({ ...receipt, phase: "unknown", everUnknown: true, error: "Observation stopped. This does not cancel a command already sent to the center." }));
        this.sending.controller.abort(); this.sending = undefined;
      }
    }
    this.publish();
  }
  refresh = async (): Promise<void> => { await this.read(false); };
  loadMore = async (): Promise<void> => { await this.read(true); };
  private async read(more: boolean) {
    if (!this.allowed() || this.reading) return;
    const controller = new AbortController(), generation = this.generation;
    this.reading = controller; this.error = undefined; this.publish();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(STEERING_LIMITS.timeoutMs)]);
    try {
      const candidate = more ? this.current : admission(await request(() => this.port.admission({}, signal), signal), this.identity.taskId);
      if (signal.aborted || generation !== this.generation || !this.allowed()) return;
      if (!candidate) return;
      const attemptId = candidate.attemptId;
      const next = new Map(this.commands);
      const shouldRead = attemptId && !(candidate.state === "unavailable" && ["disabled", "not-installed"].includes(candidate.reason));
      let pageState = attemptId ? this.pages.get(attemptId) : undefined;
      if (shouldRead) {
        if (!this.attempts().has(attemptId) && this.attempts().size >= STEERING_LIMITS.attempts) throw Error("Local attempt history is full; clear resolved history before reading another attempt.");
        let after = more ? pageState?.next : 0;
        if (after === null || after === undefined) return;
        const count = more ? 1 : Math.max(1, pageState?.count ?? 1);
        let pagesRead = 0, cursor: number | null = after;
        for (let index = 0; index < count && cursor !== null; index++) {
          if (signal.aborted || generation !== this.generation) return;
          const afterCursor = cursor;
          const page = object(await request(() => this.port.state({ attemptId, after: afterCursor, limit: STEERING_LIMITS.page }, signal), signal));
          if (signal.aborted || generation !== this.generation || !this.allowed()) return;
          if (id(page.taskId) !== this.identity.taskId || id(page.attemptId) !== attemptId || !Array.isArray(page.commands) || page.commands.length > STEERING_LIMITS.page) invalid();
          const revision = integer(page.revision); boolean(page.sealed); boolean(page.attemptAvailable);
          let previous: number = cursor;
          for (const raw of page.commands) {
            const command = reference(raw, this.identity.taskId, attemptId);
            if (command.revision <= previous || command.revision > revision || (candidate.ownerVersion !== null && command.ownerVersion !== candidate.ownerVersion)) invalid();
            previous = command.revision;
            mergeCommand(next, command);
          }
          const nextCursor = page.nextCursor === null ? null : integer(page.nextCursor, 1);
          if (nextCursor !== null && (page.commands.length !== STEERING_LIMITS.page || nextCursor !== previous || nextCursor <= cursor || nextCursor > revision)) invalid();
          if ((more ? pageState?.count ?? 0 : 0) + pagesRead + 1 > Math.ceil(MAX_STEERING_COMMANDS_PER_ATTEMPT / STEERING_LIMITS.page)) invalid();
          if ([...next.values()].filter(command => command.attemptId === attemptId).length > MAX_STEERING_COMMANDS_PER_ATTEMPT) invalid();
          pagesRead++; cursor = nextCursor;
        }
        pageState = { count: (more ? pageState?.count ?? 0 : 0) + pagesRead, next: cursor };
      }
      // Publish a whole validated batch. A page failure cannot partially replace history.
      if (generation !== this.generation || signal.aborted || !this.allowed()) return;
      // A POST may settle while these pages are in flight. Retain its validated facts.
      for (const command of this.commands.values()) mergeCommand(next, command);
      this.commands = next; this.current = candidate; if (attemptId && pageState) this.pages.set(attemptId, pageState);
      for (const [key, receipt] of this.receipts) if (receipt.command) {
        const command = next.get(receipt.command.id); if (command) this.receipts.set(key, Object.freeze({ ...receipt, command: mergeReference(receipt.command, command) }));
      }
      this.loadedAt = new Date().toISOString(); if (!more) this.stale = false;
    } catch (error) {
      if (generation === this.generation && !controller.signal.aborted) { this.error = message(error); this.stale = true; }
    } finally { if (this.reading === controller) { this.reading = undefined; this.publish(); } }
  }
  submit = async (text: string): Promise<boolean> => {
    const reason = this.reason(); if (reason || this.current?.state !== "ready") { this.error = reason; this.publish(); return false; }
    const parsed = steeringCommandSchema.safeParse({ attemptId: this.current.attemptId, ownerVersion: this.current.ownerVersion, expectedRevision: this.current.revision, text });
    if (!parsed.success) { this.error = "Use nonempty valid text, without NUL, up to 16,384 UTF-8 bytes."; this.publish(); return false; }
    const generation = this.generation; this.preparing = true; this.error = undefined; this.publish();
    try {
      const hash = await textDigest(parsed.data.text);
      if (!this.allowed() || generation !== this.generation) return false;
      const input = Object.freeze(parsed.data), key = crypto.randomUUID();
      const receipt: LocalSteeringReceipt = Object.freeze({ key, input, bytes: new TextEncoder().encode(text).byteLength, digest: hash, phase: "sending", everUnknown: false });
      this.reading?.abort(); this.reading = undefined; this.stale = true;
      this.receipts.set(key, receipt); this.preparing = false; this.dispatch(receipt); return true;
    } catch (error) { if (generation === this.generation) this.error = message(error); return false; }
    finally { if (generation === this.generation) { this.preparing = false; this.publish(); } }
  };
  retry = (key: string): boolean => {
    const receipt = this.receipts.get(key);
    if (!this.allowed() || this.preparing || this.sending || receipt?.phase !== "unknown") return false;
    this.dispatch(receipt); return true;
  };
  private dispatch(receipt: LocalSteeringReceipt) {
    const controller = new AbortController(), generation = this.generation;
    this.sending = { key: receipt.key, controller }; this.receipts.set(receipt.key, Object.freeze({ ...receipt, phase: "sending", error: undefined })); this.publish();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(STEERING_LIMITS.timeoutMs)]);
    void this.accept(receipt, signal, generation).finally(() => {
      if (this.sending?.controller === controller) { this.sending = undefined; this.publish(); if (this.allowed()) void this.refresh(); }
    });
  }
  private async accept(receipt: LocalSteeringReceipt, signal: AbortSignal, generation: number) {
    try {
      const raw = object(await request(() => this.port.accept(receipt.input, receipt.key, signal), signal)); boolean(raw.replayed);
      const command = reference(raw.command, this.identity.taskId, receipt.input.attemptId);
      if (command.ownerVersion !== receipt.input.ownerVersion || command.revision !== receipt.input.expectedRevision + 1 || command.input.bytes !== receipt.bytes || command.input.digest !== receipt.digest) invalid();
      if (receipt.command && !sameCommand(receipt.command, command)) invalid();
      if (generation !== this.generation || signal.aborted || !this.allowed()) return;
      const merged = mergeCommand(this.commands, command);
      this.receipts.set(receipt.key, Object.freeze({ ...receipt, phase: "accepted", command: merged, error: undefined }));
    } catch (error) {
      if (generation !== this.generation) return;
      const unknown = receipt.everUnknown || !rejection(error);
      this.receipts.set(receipt.key, Object.freeze({ ...receipt, phase: unknown ? "unknown" : "rejected", everUnknown: unknown, error: message(error) }));
    }
  }
  clearResolved = () => {
    if (this.sending || this.preparing) return;
    for (const [key, receipt] of this.receipts) if (receipt.phase === "rejected" || (receipt.phase === "accepted" && receipt.command && resolved(receipt.command.status))) this.receipts.delete(key);
    const retained = new Set([...this.receipts.values()].flatMap(receipt => receipt.command ? [receipt.command.id] : []));
    for (const [key, command] of this.commands) if (resolved(command.status) && !retained.has(key)) this.commands.delete(key);
    for (const attemptId of this.pages.keys()) if (attemptId !== this.current?.attemptId && ![...this.commands.values()].some(command => command.attemptId === attemptId) && ![...this.receipts.values()].some(receipt => receipt.input.attemptId === attemptId)) this.pages.delete(attemptId);
    this.publish();
  };
  dispose = () => { if (this.disposed) return; this.updateGate({ visible: false, online: false, authorized: false }); this.disposed = true; this.current = undefined; this.commands.clear(); this.receipts.clear(); this.pages.clear(); this.publish(); this.listeners.clear(); };
}
export function createSteeringControl(identity: SteeringIdentity, port: SteeringPort): SteeringControl {
  if (!identity.connectionScope.trim()) throw Error("A connection scope is required.");
  return new Control(Object.freeze({ connectionScope: identity.connectionScope, taskId: id(identity.taskId) }), port);
}
