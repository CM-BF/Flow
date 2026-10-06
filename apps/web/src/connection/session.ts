import { FlowApiError, FlowClient } from "@flow/client";
import type { BrowserSessionReady } from "@flow/contracts";
import { recoveryAddress, type RecoveryNamespace } from "../recovery/journal";

export interface ConnectionSnapshot {
  readonly address: string;
  readonly phase: "idle" | "checking" | "ready" | "offline" | "unauthenticated" | "unsupported" | "forbidden" | "error";
  readonly identity: RecoveryNamespace | null;
  readonly expiresAt?: string;
  readonly error?: string;
  readonly generation: number;
}
type SessionClient = Pick<FlowClient, "browserSession" | "connectBrowserSession" | "logoutBrowserSession">;
export type SessionClientFactory = (address: string, csrfToken: () => string | undefined) => SessionClient;
const createClient: SessionClientFactory = (baseUrl, csrfToken) => new FlowClient({ baseUrl, browserSession: { csrfToken }, assistantStreamProtocol: "patch-v1" });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "The center could not be reached.";

/** A center's cookie and the public session endpoint are the only authentication authority. */
export class ConnectionSession {
  private snapshot: ConnectionSnapshot;
  private readonly client: SessionClient;
  private readonly listeners = new Set<() => void>();
  private csrf?: string;
  private generation = 0;
  private authorityGeneration = 0;
  private flight?: AbortController;
  private expiry?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private online = true;
  constructor(address: string, private readonly factory: SessionClientFactory = createClient) {
    const canonical = recoveryAddress(address);
    this.snapshot = Object.freeze({ address: canonical, phase: "idle", identity: null, generation: 0 });
    this.client = factory(canonical, () => this.csrf);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  /** The callback is ephemeral and never stored in recovery records. */
  csrfToken = () => this.snapshot.phase === "ready" ? this.csrf : undefined;
  authorized = (namespace: RecoveryNamespace) => this.snapshot.phase === "ready" && this.snapshot.identity?.baseUrl === namespace.baseUrl
    && this.snapshot.identity.centerId === namespace.centerId && this.snapshot.identity.ownerPrincipalId === namespace.ownerPrincipalId;
  private publish(patch: Partial<ConnectionSnapshot>) {
    if (this.disposed) return;
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch, generation: this.authorityGeneration });
    this.listeners.forEach(listener => listener());
  }
  private begin(preserveReady = false) {
    if (this.disposed) throw Error("This connection is closed.");
    this.flight?.abort(); clearTimeout(this.expiry);
    const controller = new AbortController(), generation = ++this.generation;
    this.flight = controller;
    if (!preserveReady || this.snapshot.phase !== "ready") {
      this.authorityGeneration++; this.csrf = undefined;
      this.publish({ phase: this.online ? "checking" : "offline", identity: null, expiresAt: undefined, error: undefined });
    }
    return { controller, generation, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) };
  }
  private current(generation: number, signal: AbortSignal) { return !this.disposed && generation === this.generation && !signal.aborted; }
  private ready(value: BrowserSessionReady) {
    if (this.csrf !== value.csrfToken || this.snapshot.identity?.centerId !== value.centerId || this.snapshot.identity.ownerPrincipalId !== value.ownerPrincipalId) this.authorityGeneration++;
    this.csrf = value.csrfToken;
    this.publish({ phase: "ready", identity: Object.freeze({ baseUrl: this.snapshot.address, centerId: value.centerId, ownerPrincipalId: value.ownerPrincipalId }), expiresAt: value.expiresAt, error: undefined });
    // Local time only schedules another authoritative read; it never declares a session expired.
    const delay = Math.max(30_000, Math.min(2_147_483_647, Date.parse(value.expiresAt) - Date.now()));
    this.expiry = setTimeout(() => { void this.read(); }, delay);
  }
  private failure(error: unknown) {
    this.authorityGeneration++;
    this.csrf = undefined;
    const phase = !this.online || !(error instanceof FlowApiError) ? "offline" : error.status === 401 ? "unauthenticated" : error.status === 403 ? "forbidden" : "error";
    this.publish({ phase, identity: null, expiresAt: undefined, error: errorMessage(error) });
  }
  read = async (): Promise<void> => {
    if (this.disposed) return;
    const { controller, generation, signal } = this.begin(true);
    if (!this.online) return;
    try {
      const result = await this.client.browserSession(signal);
      if (!this.current(generation, signal)) return;
      if (result.state === "ready") this.ready(result);
      else { this.authorityGeneration++; this.csrf = undefined; this.publish({ phase: result.state, identity: null, expiresAt: undefined }); }
    } catch (error) { if (!this.disposed && generation === this.generation && !controller.signal.aborted) this.failure(error); }
    finally { if (this.flight === controller) this.flight = undefined; }
  };
  /** Explicit only. Always verify with cookie-only GET after POST, including a lost connect ACK. */
  connect = async (ownerToken: string): Promise<void> => {
    if (!ownerToken.trim()) throw Error("Enter the owner token for this center.");
    if (!this.online) throw Error("Reconnect to the network before connecting to the center.");
    const { controller, generation, signal } = this.begin();
    try {
      let connectError: unknown;
      try { await this.client.connectBrowserSession(ownerToken, signal); }
      catch (error) { connectError = error; }
      if (!this.current(generation, signal)) return;
      // No second connect POST: a read can recover an accepted cookie after a missing response.
      const result = await this.client.browserSession(signal);
      if (!this.current(generation, signal)) return;
      if (result.state === "ready") this.ready(result);
      else { this.publish({ phase: result.state, identity: null }); if (connectError) this.publish({ error: errorMessage(connectError) }); }
    } catch (error) { if (!this.disposed && generation === this.generation && !controller.signal.aborted) this.failure(error); }
    finally { if (this.flight === controller) this.flight = undefined; }
  };
  logout = async (): Promise<void> => {
    if (this.snapshot.phase !== "ready" || !this.csrf) throw Error("Read the current session before signing out.");
    // Revoke all public business authorization synchronously. Only this bound public-client call retains the old CSRF.
    const csrf = this.csrf, logoutClient = this.factory(this.snapshot.address, () => csrf);
    this.csrf = undefined; this.authorityGeneration++;
    this.publish({ phase: "checking", identity: null, expiresAt: undefined, error: undefined });
    this.flight?.abort(); clearTimeout(this.expiry);
    const controller = new AbortController(), generation = ++this.generation;
    this.flight = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    try {
      await logoutClient.logoutBrowserSession(signal);
      if (!this.current(generation, signal)) return;
      this.authorityGeneration++; this.csrf = undefined;
      this.publish({ phase: "unauthenticated", identity: null, expiresAt: undefined, error: undefined });
    } catch (error) { if (this.current(generation, controller.signal)) this.failure(error); }
    finally { if (this.flight === controller) this.flight = undefined; }
  };
  setOnline(online: boolean) {
    if (this.disposed || this.online === online) return;
    this.online = online;
    if (online) void this.read();
    else { this.flight?.abort(); clearTimeout(this.expiry); this.generation++; this.authorityGeneration++; this.csrf = undefined; this.publish({ phase: "offline", identity: null, error: "Offline. Saved drafts and receipts are retained; no command was cancelled." }); }
  }
  dispose() { this.disposed = true; this.generation++; this.flight?.abort(); clearTimeout(this.expiry); this.csrf = undefined; this.listeners.clear(); }
}
