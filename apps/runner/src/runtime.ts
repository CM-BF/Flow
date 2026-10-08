import { decodeVerifierRunnerClaimResponse, pluginVerifierExecutionSchema } from '../../../packages/contracts/src/verifier-runner-claim.js';
import { pluginVerificationRequestSchema } from '../../../packages/contracts/src/plugin-verification.js';
import { pluginGrantReceiptSchema } from '../../../packages/contracts/src/plugin-runtime.js';
import type { PluginVerifierBinding } from '../../../packages/contracts/src/plugin-verification-binding.js';
import { createTrustedProcessHost } from './plugins/process-host.js';
import type { PluginToolInput, PluginToolResult } from './plugins/host.js';
import type { TrustedPackageStore } from '@flow/plugin-runtime';
import type { PluginRunnerClient } from '../../../packages/client/src/plugin-runner.js';
import { decodePluginRunnerClaimResponse, pluginToolExecutionSchema, type PluginRunnerClaimResponse } from '../../../packages/contracts/src/plugin-runner-claim.js';
import { PluginAuthorizationUnknown, PluginExecutionUnsettled, executePluginTool, executePluginVerifier, type TrustedVerifierAlgorithm } from './plugins/execution.js';
import { AdmissionJournal, AdmissionStorageError } from './admission-journal.js';
import { bindGraphToolCapability } from './goal-graph-tools/bind.js';
import { bindGoalToolCapability } from './goal-tool-bridge/index.js';
import { FinalizationUnknown, FinalProposalJournal } from './active-steering/proposal.js';
import { mkdir, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { AttemptWakeup } from './attempt-wakeup.js';
import { FlowApiError, FlowClient } from '@flow/client';
import type { ClaimedTask, DecisionAnswer, HarnessAdapter, HarnessContext, RunnerEventData } from '@flow/contracts';
import { createFixtureAdapter } from './fixture.js';
import { textDigest } from './verifier.js';
import { AttemptControl, type LeaseGrant } from './attempt-control.js';
import { EventOutbox, EventStorageError, replayPending, reportBatch } from './outbox.js';
import { NativeExecutionError, type NativeExecutionSettlement } from './native-harness/settlement.js';
import { NativeActivityBodyHost } from './native-activity-body/host.js';

export type RunnerNotice = { type: 'connection-lost' | 'ownership-lost' | 'adapter-failed' | 'events-retained' | 'admission-blocked' | 'recovery-waiting'; attemptId?: string }
  | { type: 'runtime-initialized'; runnerId: string; attemptId?: never };
type PluginTransport = Pick<PluginRunnerClient, 'claim' | 'status' | 'publishHost' | 'authorize'>
  & Partial<Pick<PluginRunnerClient, 'claimVerifier' | 'statusVerifier' | 'authorizeVerifier'>>;
export interface RunnerOptions {
  baseUrl: string;
  token: string;
  workingDirectory: string;
  /** Stops admission and active attempts; an already-sent claim drains to its original request deadline. */
  signal: AbortSignal;
  adapters?: HarnessAdapter[];
  /** Trusted host opt-in. The domain transport must use this same FlowClient's request owner. */
  pluginExecution?: {
    store: TrustedPackageStore;
    executionMode?: 'in-process' | 'trusted-process';
    verifier?: { trustedAlgorithms: readonly TrustedVerifierAlgorithm[]; toolExecution?: boolean };
    transport?(client: FlowClient): PluginTransport;
  };
  /** Explicit host opt-in; public conversation capabilities remain disabled. */
  activeSteering?: boolean;
  /** Explicit single-attempt host opt-in; a current authenticated center must confirm support. */
  nativeActivityBodies?: boolean;
  /** Local native attempt bound; the center independently enforces registered capacity. */
  maxConcurrentAttempts?: number;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  requestTimeoutMs?: number;
  onNotice?: (notice: RunnerNotice) => void;
}

export async function runRunner(input: RunnerOptions): Promise<void> {
  validateOptions(input);
  if (input.signal.aborted) return;
  const shutdown = new AbortController();
  const pluginExecution = input.pluginExecution ? { ...input.pluginExecution,
    ...(input.pluginExecution.verifier ? { verifier: Object.freeze({ ...input.pluginExecution.verifier, trustedAlgorithms: Object.freeze(input.pluginExecution.verifier.trustedAlgorithms.map(item => Object.freeze({ ...item }))) }) } : {}),
    store: Object.freeze({ ...input.pluginExecution.store, allowedDigests: Object.freeze([...input.pluginExecution.store.allowedDigests]) }) } : undefined;
  const verifierQualification = pluginExecution?.verifier ? pluginVerifierExecutionSchema.parse({ bindingProtocol: 'flow.plugin-verification.v1',
    storeId: pluginExecution.store.storeId, hostApiMajor: 1, algorithms: [...new Map(pluginExecution.verifier.trustedAlgorithms.map(item => [item.algorithmId + ':' + item.algorithmVersion, { id: item.algorithmId, version: item.algorithmVersion }])).values()] }) : undefined;
  const qualification = pluginExecution && (!verifierQualification || pluginExecution.verifier?.toolExecution === true) ? pluginToolExecutionSchema.parse({ bindingProtocol: 'flow.plugin-runtime.v1',
    storeId: pluginExecution.store.storeId, hostApiMajor: 1 }) : undefined;
  const options = { ...input, pluginExecution, signal: AbortSignal.any([input.signal, shutdown.signal]) };
  let fatal: unknown;
  const stop = (error: unknown) => { fatal ??= error; shutdown.abort(error); };
  const requests = new Set<Promise<unknown>>();
  const client = authenticatedClient(options, stop, requests);
  const plugin = pluginExecution ? (pluginExecution.transport?.(client) ?? client.pluginRunner) : undefined;
  const pluginRequest = async <T>(run: () => Promise<T>): Promise<T> => {
    const pending = (async () => { try { return await run(); } catch (error) { if (isHostAuthenticationError(error)) stop(error); throw error; } })();
    requests.add(pending);
    try { return await pending; } finally { requests.delete(pending); }
  };
  let hostPublished = false;
  const bodies = new NativeActivityBodyHost(signal => client.nativeActivityBodySupport(AbortSignal.any([signal, requestSignal(options)])));
  const adapters = options.adapters ?? [createFixtureAdapter()];
  const stateDirectory = join(options.workingDirectory, textDigest(options.baseUrl.replace(/\/$/, '')));
  await prepareDirectory(stateDirectory);
  const journal = await AdmissionJournal.open(stateDirectory);
  let processHost: Awaited<ReturnType<typeof createTrustedProcessHost>> | undefined;
  const bindAdmission = (id: string) => verifierQualification
    ? journal.bindVerifierRunner(id, verifierQualification, qualification) : journal.bindRunner(id, qualification);
  const active = new Map<string, Promise<void>>();
  const wakeup = new AttemptWakeup(options.signal, options.pollIntervalMs ?? 500);
  let recoveryPending = true, disconnected = false, blockedNotice = false, waitingNotice = false;
  let runnerId: string | undefined, queryOpportunity = true, initialized = false;
  function failed(error: unknown) {
    if (error instanceof EventStorageError || isHostAuthenticationError(error)) stop(error);
    else if (!options.signal.aborted) {
      if (!disconnected) options.onNotice?.({ type: 'connection-lost' });
      disconnected = true;
    }
  }
  function start(assignment: PluginAssignment, initialLease: LeaseGrant, publishBodies: boolean) {
    const attemptId = assignment.attempt.id;
    const completion = execute(assignment, client, adapters, options, stateDirectory, initialLease, stop, bodies, publishBodies, plugin, pluginRequest, () => journal.complete({ attemptId, ownerVersion: assignment.attempt.ownerVersion }), processHost)
      .then(completed => { if (!completed) recoveryPending = true; })
      .catch(error => { failed(error); recoveryPending = true; })
      .finally(() => { active.delete(attemptId); });
    active.set(attemptId, completion);
    wakeup.track(completion);
  }
  try {
    while (!options.signal.aborted) {
      try {
        runnerId ??= (await client.runnerIdentity(requestSignal(options))).runnerId;
        await bindAdmission(runnerId);
        if (recoveryPending) {
          if (active.size) {
            if (!waitingNotice) options.onNotice?.({ type: 'recovery-waiting' });
            waitingNotice = true; await wakeup.wait(); continue;
          }
          await recover(stateDirectory, client, options, journal, bodies, runnerId);
          // A confirmed outbox completion may have made a legacy journal completely clean.
          await bindAdmission(runnerId);
          recoveryPending = false; waitingNotice = false;
        }
        if (journal.unresolved(new Set(active.keys()))) {
          if (!blockedNotice) options.onNotice?.({ type: 'admission-blocked' });
          blockedNotice = true; await wakeup.wait(); continue;
        }
        if (active.size >= (options.maxConcurrentAttempts ?? 1)) { await wakeup.wait(); continue; }
        if (options.signal.aborted) continue;
        if (pluginExecution?.executionMode === 'trusted-process' && !processHost) {
          try { processHost = await createTrustedProcessHost({ resourceRoot: join(await realpath(stateDirectory), 'plugin-process') }); }
          catch (error) { stop(error); throw error; }
        }
        if (options.signal.aborted) continue;
        // Unknown confirmation is outside execute's failed-settlement catch and before any new claim.
        const publishBodies = options.nativeActivityBodies === true
          ? await bodies.beforeAdmission(true, runnerId, requestSignal(options)) : false;
        if (plugin && !hostPublished) {
          await pluginRequest(() => plugin.publishHost({ protocol: 'flow.plugin-runtime.v1', storeId: pluginExecution!.store.storeId, hostApiMajor: 1 }, requestSignal(options)));
          hostPublished = true;
        }
        const opportunity = verifierQualification ? journal.verifierOpportunity : qualification ? journal.pluginOpportunity : journal.opportunity;
        if (!opportunity) throw new AdmissionStorageError(new Error('No runner-bound opportunity exists.'));
        if (options.signal.aborted || recoveryPending) continue;
        if (!initialized) {
          initialized = true;
          // This attests local initialization, never center admission or an actual claim.
          try { options.onNotice?.({ type: 'runtime-initialized', runnerId }); } catch { /* Observer failure cannot alter execution or replace its primary error. */ }
          if (options.signal.aborted) continue;
        }
        let requestedAt = performance.now();
        const query = (operation: 'claim' | 'status', signal: AbortSignal) => {
          if (opportunity.protocol === 'flow.runner-claim.v4') {
            const method = operation === 'claim' ? plugin?.claimVerifier : plugin?.statusVerifier;
            if (!method) throw new AdmissionStorageError(new Error('Verifier admission transport is unavailable.'));
            return pluginRequest(async () => decodeVerifierRunnerClaimResponse(await method.call(plugin, opportunity, signal), opportunity, operation));
          }
          if (opportunity.protocol === 'flow.runner-claim.v3') {
            if (!plugin) throw new AdmissionStorageError(new Error('Persisted plugin capability is unavailable.'));
            return pluginRequest(async () => decodePluginRunnerClaimResponse(await plugin[operation](opportunity, signal), opportunity, operation));
          }
          return operation === 'claim' ? client.claimOpportunity(opportunity, signal) : client.claimOpportunityStatus(opportunity, signal);
        };
        let response = queryOpportunity ? await query('status', requestSignal(options)) : undefined;
        if (!response || response.state === 'missing') {
          if (options.signal.aborted || recoveryPending) continue;
          requestedAt = performance.now();
          // A sent mutation drains to its original deadline on normal stop; fatal shutdown still preempts it.
          response = await query('claim', requestSignal(options, shutdown.signal));
        }
        disconnected = false;
        if (response.state === 'unavailable') {
          queryOpportunity = true;
          if (!blockedNotice) options.onNotice?.({ type: 'admission-blocked' });
          blockedNotice = true; await wakeup.wait(); continue;
        }
        queryOpportunity = false; blockedNotice = false;
        if (response.state === 'assigned') {
          await journal.acceptOpportunity(opportunity, response.identity);
          if (!options.signal.aborted) start(response.assignment, { requestedAt, remainingLeaseMs: response.remainingLeaseMs }, publishBodies);
        } else await wakeup.wait(); // Empty observes the same durable key without a journal write.
      } catch (error) {
        failed(error); recoveryPending = true; queryOpportunity = true;
        if (!options.signal.aborted) await wakeup.wait();
      }
    }
  } finally {
    wakeup.close();
    shutdown.abort();
    await Promise.allSettled(active.values());
    await Promise.allSettled(requests);
    try { await processHost?.close(); } catch (error) { stop(error); }
  }
  if (fatal) throw fatal;
}

async function recover(directory: string, client: FlowClient, options: RunnerOptions, journal: AdmissionJournal, bodies: NativeActivityBodyHost, runnerId: string) {
  await replayPending(directory, async batch => {
    const signal = requestSignal(options);
    await bodies.beforeReport(batch, runnerId, signal);
    await reportBatch(client, batch, signal);
    if (batch.events.some(event => event.type === 'completed')) await journal.complete(batch);
  }, attemptId => options.onNotice?.({ type: 'events-retained', attemptId }));
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const recovered = await new FinalProposalJournal(join(directory, entry.name)).recover(input => client.steeringProposalStatus(input, requestSignal(options)));
    if (recovered !== 'missing') options.onNotice?.({ type: 'events-retained', attemptId: recovered.attemptId });
  }
}

function isHostAuthenticationError(error: unknown): boolean {
  // Goal/grant/attempt scope denials are local authorization failures, not revoked host credentials.
  return error instanceof FlowApiError && (error.status === 401 || error.status === 403 && error.code === 'wrong_role');
}

/** Observe auth before heartbeat, replay or tool adapters can translate the original rejection. */
function authenticatedClient(options: RunnerOptions, stop: (error: unknown) => void, pending: Set<Promise<unknown>>): FlowClient {
  const client = new FlowClient(options);
  function guard<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) {
    return (...args: Args): Promise<Result> => {
      const request = (async () => {
        try { return await operation(...args); }
        catch (error) { if (isHostAuthenticationError(error)) stop(error); throw error; }
      })();
      pending.add(request);
      void request.then(() => pending.delete(request), () => pending.delete(request));
      return request;
    };
  }
  client.claim = guard(client.claim.bind(client));
  client.runnerIdentity = guard(client.runnerIdentity.bind(client));
  client.nativeActivityBodySupport = guard(client.nativeActivityBodySupport.bind(client));
  client.claimOpportunity = guard(client.claimOpportunity.bind(client));
  client.claimOpportunityStatus = guard(client.claimOpportunityStatus.bind(client));
  client.heartbeat = guard(client.heartbeat.bind(client));
  client.report = guard(client.report.bind(client));
  client.steeringMailbox = guard(client.steeringMailbox.bind(client));
  client.finalizeSteering = guard(client.finalizeSteering.bind(client));
  client.steeringProposalStatus = guard(client.steeringProposalStatus.bind(client));
  client.goalToolGrant = guard(client.goalToolGrant.bind(client));
  client.goalToolSnapshot = guard(client.goalToolSnapshot.bind(client));
  client.goalToolInput = guard(client.goalToolInput.bind(client));
  client.goalToolCommand = guard(client.goalToolCommand.bind(client));
  client.goalGraphGrant = guard(client.goalGraphGrant.bind(client));
  client.goalGraphRead = guard(client.goalGraphRead.bind(client));
  client.goalGraphDetail = guard(client.goalGraphDetail.bind(client));
  client.goalGraphCommand = guard(client.goalGraphCommand.bind(client));
  return client;
}

type PluginAssignment = ClaimedTask & { pluginToolBinding?: Extract<PluginRunnerClaimResponse, { state: 'assigned' }>['assignment']['pluginToolBinding']; pluginVerifierBinding?: PluginVerifierBinding };
async function execute(assignment: PluginAssignment, client: FlowClient, adapters: HarnessAdapter[], options: RunnerOptions, stateDirectory: string, initialLease: LeaseGrant, stop: (error: unknown) => void, bodies: NativeActivityBodyHost, publishBodies: boolean, plugin: PluginTransport | undefined, pluginRequest: <T>(run: () => Promise<T>) => Promise<T>, completeAdmission: () => Promise<void>, processHost?: Awaited<ReturnType<typeof createTrustedProcessHost>>): Promise<boolean> {
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const directory = join(stateDirectory, textDigest(assignment.attempt.id));
  await prepareDirectory(directory);
  const control = new AttemptControl(assignment, client, options, initialLease);
  const outbox = new EventOutbox(directory, ownership, async batch => {
    try {
      const signal = requestSignal(options);
      await bodies.beforeReport(batch, assignment.attempt.runnerId, signal);
      await reportBatch(client, batch, signal);
      // Match recovery: validated completion ACK -> durable admission clear -> outbox unlink.
      if (batch.events.some(event => event.type === 'completed')) await completeAdmission();
    }
    catch (error) { control.interrupt('lost'); throw error; }
  });
  const emit = (data: RunnerEventData) => outbox.emit(data).catch(error => {
    if (error instanceof EventStorageError) stop(error);
    throw error;
  });
  const decisions = new Map<string, { prompt: string; answer: Promise<DecisionAnswer['answer']> }>();
  let pendingDecision: string | undefined;
  const context: HarnessContext = {
    task: assignment.task, workingDirectory: directory, signal: control.signal,
    emit(data) {
      if (data.type === 'completed' || data.type === 'decision' || data.type === 'native-activity-body') throw new Error('Lifecycle and body transport events belong to the runner runtime.');
      return emit(data);
    },
    assertOwnership: () => control.assertOwnership(),
    async waitForDecision(request) {
      const existing = decisions.get(request.id);
      if (existing) {
        if (existing.prompt !== request.prompt) throw new Error('Decision IDs cannot be reused with different prompts.');
        const answer = await existing.answer;
        await control.assertOwnership();
        return answer;
      }
      if (pendingDecision) throw new Error('Only one decision can be pending per attempt.');
      pendingDecision = request.id;
      const answer = emit({ type: 'decision', decisionId: request.id, prompt: request.prompt })
        .then(() => control.answer(request.id)).finally(() => { pendingDecision = undefined; });
      decisions.set(request.id, { prompt: request.prompt, answer });
      return answer;
    },
  };
  Object.defineProperty(context, 'executionIdentity', {
    value: Object.freeze({ taskId: assignment.task.id, attemptId: assignment.attempt.id,
      ownerVersion: assignment.attempt.ownerVersion, runnerId: assignment.attempt.runnerId }),
    enumerable: true,
  });
  const adapter = adapters.find(adapter => adapter.name === assignment.task.harness);
  let outcome: 'succeeded' | 'failed' | 'cancelled' = 'succeeded';
  let nativeSettlement: NativeExecutionSettlement = 'settled';
  let terminalEvents: RunnerEventData[] | undefined;
  try {
    if (assignment.pluginVerifierBinding) {
      const binding = assignment.pluginVerifierBinding;
      if (!options.pluginExecution?.verifier || !plugin?.authorizeVerifier || assignment.pluginToolBinding
        || options.pluginExecution.executionMode === 'trusted-process' && !processHost) {
        throw new PluginExecutionUnsettled(binding.bindingId, binding.invocationId);
      }
      await control.assertOwnership();
      const verification = pluginVerificationRequestSchema.parse(JSON.parse(assignment.task.prompt));
      if (textDigest(assignment.task.prompt) !== binding.inputDigest) throw new Error('Verifier input digest does not match the pinned task.');
      const result = await executePluginVerifier({ store: options.pluginExecution.store,
        binding: { bindingId: binding.bindingId, invocationId: binding.invocationId, taskId: binding.taskId, ...ownership,
          material: { installationId: binding.materialId, storeId: binding.storeId, artifact: binding.artifact, treeDigest: binding.treeDigest },
          configuration: Object.fromEntries(Object.entries(binding.configuration).map(([key, value]) => [key, String(value)])) },
        verification, trustedAlgorithms: options.pluginExecution.verifier.trustedAlgorithms,
        ...(processHost ? { invokeVerifier: processHost.invokeVerifier } : {}),
        signal: control.signal, assertOwnership: context.assertOwnership,
        authorize: async (_, phase) => {
          const request = { ...ownership, bindingId: binding.bindingId, invocationId: binding.invocationId, phase };
          const key = textDigest(JSON.stringify([assignment.attempt.runnerId, binding.bindingId, binding.invocationId,
            ownership.attemptId, ownership.ownerVersion, phase]));
          try {
            const receipt = pluginGrantReceiptSchema.parse(await pluginRequest(() => plugin.authorizeVerifier!(request, key, AbortSignal.any([control.signal, requestSignal(options)]))));
            if (receipt.taskId !== assignment.task.id || receipt.runnerId !== assignment.attempt.runnerId
              || receipt.bindingId !== binding.bindingId || receipt.invocationId !== binding.invocationId
              || receipt.attemptId !== ownership.attemptId || receipt.ownerVersion !== ownership.ownerVersion
              || receipt.phase !== phase || receipt.replayed) throw new PluginAuthorizationUnknown();
          } catch (error) {
            if (error instanceof FlowApiError && error.status >= 400 && error.status < 500) throw error;
            throw new PluginAuthorizationUnknown();
          }
        } });
      await control.assertOwnership();
      const content = JSON.stringify(result.output), version = textDigest(content), artifactId = `plugin-${binding.invocationId}`;
      const pluginSource = { protocol: 'flow.plugin-artifact.v1' as const, ...result.provenance };
      terminalEvents = [{ type: 'artifact', artifactId, title: 'Plugin verifier output', content, mediaType: 'application/json', version, pluginSource },
        { type: 'verification', verifierId: 'flow.plugin-json-object', verifierVersion: '1', artifactId, artifactVersion: version,
          inputDigest: result.output.inputDigest, result: result.output.verdict.result, verdict: result.output.verdict, pluginSource }];
      outcome = result.output.verdict.result === 'passed' ? 'succeeded' : 'failed';
    } else if (assignment.pluginToolBinding) {
      if (!options.pluginExecution || !plugin) throw new PluginExecutionUnsettled(assignment.pluginToolBinding.bindingId, assignment.pluginToolBinding.invocationId);
      await control.assertOwnership();
      const binding = assignment.pluginToolBinding;
      const result = await executePluginTool({ binding, task: assignment.task, ownership, runnerId: assignment.attempt.runnerId,
        store: options.pluginExecution.store, invokeTool: processHost?.invoke, signal: control.signal, assertOwnership: context.assertOwnership,
        authorize: async request => {
          const key = textDigest(JSON.stringify([assignment.attempt.runnerId, binding.bindingId, binding.invocationId,
            ownership.attemptId, ownership.ownerVersion, request.phase]));
          try { return await pluginRequest(() => plugin.authorize(request, key, AbortSignal.any([control.signal, requestSignal(options)]))); }
          catch (error) {
            if (error instanceof FlowApiError && error.status >= 400 && error.status < 500) throw error;
            throw new PluginAuthorizationUnknown();
          }
        } });
      terminalEvents = [result.artifact, result.verification];
    } else {
      if (!adapter) throw new Error('The assigned harness is unavailable.');
      await control.assertOwnership();
      if (publishBodies) context.activityBodies = await bodies.publisher({
        runnerId: assignment.attempt.runnerId, signal: control.signal, assertOwnership: context.assertOwnership,
        publish: material => outbox.publishActivityBody(material), lost: () => control.interrupt('lost'),
      });
      if (assignment.goalToolRun && assignment.goalGraphRun) throw new Error('Conflicting planner authorities.');
      if (assignment.goalGraphRun) context.goalGraphTools = await bindGraphToolCapability({ client, assignment, signal: control.signal, assertOwnership: context.assertOwnership });
      if (assignment.goalToolRun) context.goalTools = await bindGoalToolCapability({ client, assignment, signal: control.signal, assertOwnership: context.assertOwnership });
      if (options.activeSteering && adapter.name === 'claude') context.steering = {
        async mailbox() { await control.assertOwnership(); return client.steeringMailbox(ownership, AbortSignal.any([control.signal, requestSignal(options)])); },
        async finalize(input) {
          await control.assertOwnership();
          try { return await outbox.finalize(input, {
            submit: proposal => client.finalizeSteering(proposal, requestSignal(options)),
            status: proposal => client.steeringProposalStatus(proposal, requestSignal(options)),
          }); } catch (error) { if (error instanceof FinalizationUnknown) control.interrupt('lost'); throw error; }
        },
      };
      await adapter.run(context);
    }
  } catch (error) {
    if (error instanceof EventStorageError) throw error;
    if (error instanceof PluginExecutionUnsettled || error instanceof NativeExecutionError && error.settlement === 'unknown') {
      nativeSettlement = 'unknown';
      control.interrupt('lost');
    } else if (!options.signal.aborted && control.reason !== 'lost') {
      if (control.reason !== 'cancel') options.onNotice?.({ type: 'adapter-failed', attemptId: assignment.attempt.id });
      outcome = control.reason === 'cancel' ? 'cancelled' : 'failed';
    }
  } finally { control.close(); await outbox.settle(); }
  // A prior cancel reason stays authoritative in AttemptControl, but is not proof
  // that an adapter's external execution stopped. Retain its admission in that case.
  if (nativeSettlement === 'settled' && !options.signal.aborted && control.reason !== 'lost') {
    const completed: RunnerEventData = { type: 'completed', outcome, ...(assignment.pluginVerifierBinding ? { pluginCompletion: { state: 'settled' as const } } : {}), ...(outcome === 'failed' ? { error: 'Harness execution did not complete.' } : {}) };
    if (terminalEvents) await outbox.emitBatch([...terminalEvents, completed]);
    else await emit(completed);
    return true;
  }
  return false;
}

function requestSignal(options: RunnerOptions, signal = options.signal) {
  return AbortSignal.any([signal, AbortSignal.timeout(options.requestTimeoutMs ?? 1500)]);
}

function validateOptions(options: RunnerOptions) {
  const limit = options.maxConcurrentAttempts === undefined ? 1 : options.maxConcurrentAttempts;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 16) throw new Error('Runner concurrent attempts must be an integer from one through sixteen.');
  if (options.nativeActivityBodies && limit !== 1) throw new Error('Public material publishing requires a single-attempt host until aggregate retention is qualified.');
  for (const duration of [options.pollIntervalMs ?? 500, options.heartbeatIntervalMs ?? 2000, options.requestTimeoutMs ?? 1500]) {
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 2_147_483_647) throw new Error('Runner intervals must be positive 32-bit integers.');
  }
  if ((options.heartbeatIntervalMs ?? 2000) > 2000) throw new Error('Runner heartbeats must be at most two seconds apart.');
  if (!options.token || !options.workingDirectory) throw new Error('Runner token and working directory are required.');
}

async function prepareDirectory(directory: string): Promise<void> {
  try { await mkdir(directory, { recursive: true, mode: 0o700 }); }
  catch (error) { throw new AdmissionStorageError(error); }
}
