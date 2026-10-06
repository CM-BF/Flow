/** The journal stores original requests, not a second command state machine. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export const RECOVERY_LIMITS = Object.freeze({ initialBytes: 128 * 1024, growthBytes: 32 * 1024, totalBytes: 4 * 1024 * 1024, drafts: 32, commands: 128 });
export interface RecoveryNamespace { baseUrl: string; centerId: string; ownerPrincipalId: string }
export interface RecoveryOwner { viewKey: string; routeId: string; projectId?: string }
export interface DraftRecord {
  schema: 1; kind: "draft"; id: string; namespace: string; owner: RecoveryOwner; version: number; updatedAt: number; data: Json;
}
export interface CommandRecord {
  schema: 1; kind: "command"; id: string; namespace: string; owner: RecoveryOwner; version: number; updatedAt: number;
  domain: "outbox" | "queue" | "steering"; slot: string; frozen: Json; display: Json;
  phase: "prepared" | "dispatching" | "unknown" | "accepted" | "rejected";
  stage: "create" | "submit"; checkpoint: Json; initialBytes: number; reserveBytes: number;
}
export type RecoveryRecord = DraftRecord | CommandRecord;
export interface FrozenCommand { id: string; domain: CommandRecord["domain"]; slot: string; frozen: Json; display?: Json; stage?: CommandRecord["stage"] }
export interface DraftTransfer { id: string; version: number }
export interface CommandCheckpoint { phase: CommandRecord["phase"]; stage?: CommandRecord["stage"]; data?: Json; slot?: string }
export interface CommandRecovery {
  prepare(command: FrozenCommand): Promise<void>;
  dispatch(id: string, stage?: CommandRecord["stage"]): Promise<void>;
  checkpoint(id: string, value: CommandCheckpoint): Promise<void>;
  dismiss(id: string): Promise<void>;
}
export class RecoveryError extends Error {
  constructor(readonly code: "unavailable" | "invalid" | "conflict" | "capacity" | "commit", message: string) { super(message); this.name = "RecoveryError"; }
}
const fail = (code: RecoveryError["code"], message: string): never => { throw new RecoveryError(code, message); };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const bounded = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const counter = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const next = (value: number) => counter(value) && value < Number.MAX_SAFE_INTEGER ? value + 1 : fail("capacity", "Recovery generation capacity reached.");
export function jsonBytes(value: unknown): number {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return fail("invalid", "Recovery data cannot be serialized.");
  return new TextEncoder().encode(encoded).byteLength;
}
/** Persist an API base path, never credentials, query parameters or fragments. */
export function recoveryAddress(input: string, base?: string): string {
  const url = new URL(input || "/api", base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    return fail("invalid", "Use a center URL without credentials, query parameters or a fragment.");
  const result = url.href.replace(/\/$/, "");
  if (new TextEncoder().encode(result).byteLength > 4096) return fail("invalid", "The center address is too long to retain safely.");
  return result;
}
export function namespaceKey(value: RecoveryNamespace): string {
  if (!uuid.test(value.centerId) || !uuid.test(value.ownerPrincipalId) || recoveryAddress(value.baseUrl) !== value.baseUrl)
    return fail("invalid", "A verified center and owner identity are required for recovery.");
  return JSON.stringify([value.baseUrl, value.centerId, value.ownerPrincipalId]);
}
function validOwner(value: unknown): value is RecoveryOwner {
  return object(value) && typeof value.viewKey === "string" && uuid.test(value.viewKey) && bounded(value.routeId, 192)
    && (value.projectId === undefined || bounded(value.projectId, 128));
}
function jsonValue(value: unknown, depth = 0): value is Json {
  if (depth > 32) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => jsonValue(item, depth + 1));
  return object(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(item => jsonValue(item, depth + 1));
}
/** Validates the envelope. Its owner must also validate public request schemas before hydration. */
export function parseRecoveryRecord(value: unknown): RecoveryRecord {
  if (!object(value) || value.schema !== 1 || !bounded(value.id, 128) || !bounded(value.namespace, 8192) || !validOwner(value.owner)
    || !counter(value.version) || value.version === 0 || !counter(value.updatedAt)) return fail("invalid", "Stored recovery data is invalid; it has been left untouched.");
  if (value.kind === "draft" && jsonValue(value.data)) return value as unknown as DraftRecord;
  if (value.kind === "command" && ["outbox", "queue", "steering"].includes(String(value.domain)) && bounded(value.slot, 512)
    && ["prepared", "dispatching", "unknown", "accepted", "rejected"].includes(String(value.phase)) && ["create", "submit"].includes(String(value.stage))
    && jsonValue(value.frozen) && jsonValue(value.display) && jsonValue(value.checkpoint) && counter(value.initialBytes) && value.initialBytes <= RECOVERY_LIMITS.initialBytes
    && value.reserveBytes === RECOVERY_LIMITS.growthBytes) return value as unknown as CommandRecord;
  return fail("invalid", "Stored recovery data is invalid; it has been left untouched.");
}
interface Manifest { schema: 1; generation: number; chargedBytes: number }
interface Snapshot { records: RecoveryRecord[]; manifest: Manifest }
const storageKey = (namespace: string, id: string) => JSON.stringify([namespace, id]);
function slotBytes(record: CommandRecord): number { return jsonBytes([record.namespace, record.slot, record.id, record.version]); }
function recordBytes(record: RecoveryRecord): number { return jsonBytes(record) + jsonBytes(storageKey(record.namespace, record.id)) + (record.kind === "command" ? slotBytes(record) : 0); }
function validateBudget(records: RecoveryRecord[], generation: number): Manifest {
  let chargedBytes = 0, drafts = 0, commands = 0;
  for (const record of records) {
    const bytes = recordBytes(record);
    if (record.kind === "draft") { drafts++; if (bytes > RECOVERY_LIMITS.initialBytes) fail("capacity", "This complete draft exceeds local recovery capacity. Keep the draft and shorten it explicitly."); chargedBytes += bytes; }
    else {
      commands++;
      if (bytes > record.initialBytes + record.reserveBytes) fail("capacity", "The receipt checkpoint exceeds its reserved capacity. Original request keys remain retained.");
      chargedBytes += record.initialBytes + record.reserveBytes;
    }
  }
  // Namespace and index strings are charged in each record and key, conservatively, not shared for free.
  const payloadBytes = chargedBytes;
  const manifest = { schema: 1 as const, generation, chargedBytes };
  for (let pass = 0; pass < 4; pass++) { manifest.chargedBytes = chargedBytes; chargedBytes = payloadBytes + jsonBytes(manifest); }
  if (drafts > RECOVERY_LIMITS.drafts || commands > RECOVERY_LIMITS.commands || chargedBytes > RECOVERY_LIMITS.totalBytes)
    fail("capacity", "Local recovery storage is full. Resolve or explicitly remove your retained records before sending. No other account's records are shown.");
  return { ...manifest, chargedBytes };
}
export function recoveryValue(value: unknown): Json {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!jsonValue(parsed)) return fail("invalid", "Recovery data contains unsupported values.");
  return parsed;
}
function sameFrozen(a: Json, b: Json) { return JSON.stringify(a) === JSON.stringify(b); }
const unresolved = (record: CommandRecord) => !["accepted", "rejected"].includes(record.phase);
function assertSlot(records: RecoveryRecord[], record: CommandRecord, slot = record.slot) {
  if (records.some(other => other.kind === "command" && other.namespace === record.namespace && other.id !== record.id && other.slot === slot && unresolved(other)))
    fail("conflict", "Another tab has an unresolved command in this slot. Recover that receipt instead of replacing it.");
}

/** One database transaction serializes CAS, slot admission and global reserved-byte accounting across tabs. */
export class ConversationRecoveryJournal {
  private database?: Promise<IDBDatabase>;
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB, private readonly name = "flow.conversation-recovery.v1") {}
  private open(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new RecoveryError("unavailable", "Durable recovery storage is unavailable. You can keep editing; sending is paused."));
    if (!this.database) this.database = new Promise((resolve, reject) => {
      const request = this.factory!.open(this.name, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore("records"); request.result.createObjectStore("manifest"); };
      request.onerror = () => reject(new RecoveryError("unavailable", "Recovery storage could not be opened. Existing data has not been cleared."));
      request.onblocked = () => reject(new RecoveryError("unavailable", "Another tab is blocking recovery storage. Close that tab before retrying."));
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); this.database = undefined; }; resolve(db); };
    });
    return this.database;
  }
  private async transaction<T>(mode: IDBTransactionMode, operation: (snapshot: Snapshot) => T): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      let result: T, failed: unknown;
      const transaction = database.transaction(["records", "manifest"], mode, mode === "readwrite" ? { durability: "strict" } : undefined);
      const store = transaction.objectStore("records"), manifestStore = transaction.objectStore("manifest");
      const recordsRequest = store.getAll(), manifestRequest = manifestStore.get("current");
      let completed = 0;
      const ready = () => {
        if (++completed !== 2) return;
        try {
          const records = recordsRequest.result.map(parseRecoveryRecord);
          const raw: unknown = manifestRequest.result;
          if (raw !== undefined && (!object(raw) || raw.schema !== 1 || !counter(raw.generation) || !counter(raw.chargedBytes))) fail("invalid", "Recovery manifest is invalid. Existing records were not cleared.");
          const generation = raw === undefined ? 0 : (raw as Manifest).generation;
          const snapshot = { records, manifest: validateBudget(records, generation) };
          if (raw !== undefined && (raw as Manifest).chargedBytes !== snapshot.manifest.chargedBytes) fail("invalid", "Recovery accounting does not match its records. Sending is paused.");
          result = operation(snapshot);
          if (mode === "readwrite") {
            const manifest = validateBudget(snapshot.records, next(generation));
            // All writes stay within this active transaction; there is no network, digest or external await here.
            const retained = new Set(snapshot.records.map(record => storageKey(record.namespace, record.id)));
            for (const record of records) if (!retained.has(storageKey(record.namespace, record.id))) store.delete(storageKey(record.namespace, record.id));
            for (const record of snapshot.records) store.put(record, storageKey(record.namespace, record.id));
            manifestStore.put(manifest, "current");
          }
        } catch (error) { failed = error; transaction.abort(); }
      };
      recordsRequest.onsuccess = ready; manifestRequest.onsuccess = ready;
      transaction.oncomplete = () => resolve(result!);
      transaction.onabort = () => reject(failed ?? new RecoveryError("commit", "Recovery transaction did not commit. No new request may be sent."));
      transaction.onerror = () => { /* abort is the authoritative terminal event, including quota failures after put success. */ };
    });
  }
  async list(namespace: RecoveryNamespace): Promise<readonly RecoveryRecord[]> {
    const key = namespaceKey(namespace);
    return this.transaction("readonly", snapshot => snapshot.records.filter(record => record.namespace === key));
  }
  async saveDraft(namespace: RecoveryNamespace, owner: RecoveryOwner, data: Json, expectedVersion: number): Promise<DraftRecord> {
    if (!validOwner(owner) || !jsonValue(data)) return fail("invalid", "Invalid draft identity or material metadata.");
    const key = namespaceKey(namespace), id = `draft:${owner.viewKey}`;
    return this.transaction("readwrite", snapshot => {
      const old = snapshot.records.find(record => record.namespace === key && record.id === id);
      if ((old?.version ?? 0) !== expectedVersion || (old && old.kind !== "draft")) fail("conflict", "This draft changed in another tab. Your current draft was kept in memory.");
      const record: DraftRecord = { schema: 1, kind: "draft", id, namespace: key, owner: { ...owner }, data, version: next(expectedVersion), updatedAt: Date.now() };
      snapshot.records = [...snapshot.records.filter(item => item !== old), record]; return record;
    });
  }
  bind(namespace: RecoveryNamespace, owner: () => RecoveryOwner, authorized: () => boolean, transfer?: () => DraftTransfer | undefined): CommandRecovery {
    const key = namespaceKey(namespace);
    const assert = () => { if (!authorized()) fail("unavailable", "Reconnect and authorize this exact view before writing a recovery checkpoint."); };
    const change = async (id: string, apply: (record: CommandRecord, records: RecoveryRecord[]) => CommandRecord) => {
      assert();
      return this.transaction("readwrite", snapshot => {
        assert(); const old = snapshot.records.find(record => record.namespace === key && record.id === id);
        if (old?.kind !== "command") return fail("invalid", "The original durable command is missing. No replacement request was created.");
        const record = apply(old, snapshot.records);
        snapshot.records = snapshot.records.map(item => item === old ? { ...record, version: next(old.version), updatedAt: Date.now() } : item);
      });
    };
    return {
      prepare: async command => {
        assert(); const identity = owner(), handoff = transfer?.();
        if (!validOwner(identity) || !bounded(command.id, 128) || !bounded(command.slot, 512) || !jsonValue(command.frozen)) fail("invalid", "The complete original command cannot be persisted.");
        await this.transaction("readwrite", snapshot => {
          assert(); const old = snapshot.records.find(record => record.namespace === key && record.id === command.id);
          if (old) {
            if (old.kind !== "command" || old.owner.viewKey !== identity.viewKey || old.domain !== command.domain || !sameFrozen(old.frozen, command.frozen)) fail("conflict", "The retained command identity differs. Its original key was not replaced.");
            return;
          }
          let record: CommandRecord = { schema: 1, kind: "command", id: command.id, namespace: key, owner: { ...identity }, domain: command.domain, slot: command.slot,
            frozen: command.frozen, display: command.display ?? null, phase: "prepared", stage: command.stage ?? "submit", checkpoint: null, version: 1, updatedAt: Date.now(), initialBytes: 0, reserveBytes: RECOVERY_LIMITS.growthBytes };
          assertSlot(snapshot.records, record);
          // Account the final decimal length of the initial reservation itself.
          record.initialBytes = recordBytes(record); record.initialBytes = recordBytes(record);
          if (record.initialBytes > RECOVERY_LIMITS.initialBytes) fail("capacity", "The complete command exceeds local recovery capacity. Its original receipt and materials remain in this page; no HTTP was sent.");
          if (handoff) {
            const draft = snapshot.records.find(item => item.namespace === key && item.id === handoff.id);
            if (draft?.kind !== "draft" || draft.version !== handoff.version || draft.owner.viewKey !== identity.viewKey) fail("conflict", "The source draft changed before handoff. No request was sent.");
            snapshot.records = snapshot.records.filter(item => item !== draft);
          }
          snapshot.records.push(record);
        });
      },
      dispatch: (id, stage = "submit") => change(id, (record, records) => { assertSlot(records, record); return { ...record, phase: "dispatching", stage }; }),
      checkpoint: (id, checkpoint) => change(id, (record, records) => {
        if (checkpoint.slot) assertSlot(records, record, checkpoint.slot);
        const data = checkpoint.data ?? record.checkpoint;
        if (!jsonValue(data)) fail("invalid", "The receipt identity cannot be persisted.");
        return { ...record, phase: checkpoint.phase, stage: checkpoint.stage ?? record.stage, slot: checkpoint.slot ?? record.slot, checkpoint: data };
      }),
      dismiss: async id => {
        assert(); await this.transaction("readwrite", snapshot => {
          assert(); const record = snapshot.records.find(item => item.namespace === key && item.id === id);
          if (record?.kind === "command" && unresolved(record)) fail("conflict", "An unresolved command must remain available with its original key.");
          snapshot.records = snapshot.records.filter(item => item !== record);
        });
      },
    };
  }
  async removeDraft(namespace: RecoveryNamespace, id: string, expectedVersion: number) {
    const key = namespaceKey(namespace);
    return this.transaction("readwrite", snapshot => {
      const record = snapshot.records.find(item => item.namespace === key && item.id === id);
      if (!record || record.kind !== "draft" || record.version !== expectedVersion) fail("conflict", "The draft changed; it was not removed.");
      snapshot.records = snapshot.records.filter(item => item !== record);
    });
  }
  async close() { const database = await this.database?.catch(() => undefined); database?.close(); this.database = undefined; }
}
