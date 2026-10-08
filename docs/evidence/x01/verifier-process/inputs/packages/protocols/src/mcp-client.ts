import { Client, StreamableHTTPClientTransport, ProtocolError, type ElicitRequestParams, type ElicitResult, type RequestOptions } from '@modelcontextprotocol/client';
import { guardedFetch, remoteUrl, RemoteOutcomeUncertainError, type RemoteOptions } from './http-policy.js';

export interface McpOptions extends RemoteOptions {
  authorizeTool?: (request: { name: string; arguments: Record<string, unknown> }) => Promise<boolean>;
  /** Host must present the request to an authorized user; no implicit acceptance. */
  elicit?: (request: ElicitRequestParams, signal: AbortSignal) => Promise<ElicitResult>;
}
export async function connectMcp(options: McpOptions): Promise<McpPeer> {
  const sdk = new Client({ name: 'flow', version: '0.1.0' }, {
    versionNegotiation: { mode: { pin: '2026-07-28' } },
    enforceStrictCapabilities: true,
    listMaxPages: 4,
    capabilities: options.elicit ? { elicitation: { form: {} } } : {},
    inputRequired: { autoFulfill: true, maxRounds: 4 },
  });
  if (options.elicit) sdk.setRequestHandler('elicitation/create', (request, context) => options.elicit!(request.params, context.mcpReq.signal));
  const transport = new StreamableHTTPClientTransport(remoteUrl(options), {
    fetch: guardedFetch(options), protocolVersion: '2026-07-28', requestInit: { redirect: 'error' },
    reconnectionOptions: { maxRetries: 0, maxReconnectionDelay: 1000, initialReconnectionDelay: 100, reconnectionDelayGrowFactor: 1 }, onInsufficientScope: 'throw',
  });
  try { await sdk.connect(transport); }
  catch (error) { await sdk.close(); throw error; }
  return new McpPeer(sdk, options);
}

export class McpPeer {
  readonly version = '2026-07-28';
  constructor(private readonly sdk: Client, private readonly options: McpOptions) {}
  get capabilities() { return this.sdk.getServerCapabilities(); }
  get tasks() {
    const extensions = this.capabilities?.extensions as Record<string, unknown> | undefined;
    return { advertised: Object.hasOwn(extensions ?? {}, 'io.modelcontextprotocol/tasks'), supported: false as const, reason: 'sdk-extension-not-supported' as const };
  }
  close(): Promise<void> { return this.sdk.close(); }
  tools(cursor?: string, options?: RequestOptions) { return this.sdk.listTools(cursor ? { cursor } : undefined, this.limits(options)); }
  resources(cursor?: string, options?: RequestOptions) { return this.sdk.listResources(cursor ? { cursor } : undefined, this.limits(options)); }
  resourceTemplates(cursor?: string, options?: RequestOptions) { return this.sdk.listResourceTemplates(cursor ? { cursor } : undefined, this.limits(options)); }
  prompts(cursor?: string, options?: RequestOptions) { return this.sdk.listPrompts(cursor ? { cursor } : undefined, this.limits(options)); }
  readResource(uri: string, options?: RequestOptions) { return this.sdk.readResource({ uri }, this.limits(options)); }
  getPrompt(name: string, args?: Record<string, string>, options?: RequestOptions) { return this.sdk.getPrompt({ name, arguments: args }, this.limits(options)); }

  async callTool(name: string, args: Record<string, unknown> = {}, options?: RequestOptions) {
    if (!this.capabilities?.tools) throw new Error('Peer does not advertise tools.');
    if (!this.options.authorizeTool || !await this.options.authorizeTool({ name, arguments: args })) throw new Error('Tool call was not authorized by the host.');
    options?.signal?.throwIfAborted();
    try { return await this.sdk.callTool({ name, arguments: args }, this.limits(options)); }
    catch (error) {
      if (error instanceof ProtocolError) throw error;
      // Includes aborted calls and unsupported task results: neither proves the tool did not run.
      throw new RemoteOutcomeUncertainError(`MCP tools/call ${name}`, undefined, error);
    }
  }
  private limits(options: RequestOptions = {}): RequestOptions {
    return { timeout: this.options.timeoutMs ?? 15_000, maxTotalTimeout: this.options.timeoutMs ?? 15_000, ...options, resetTimeoutOnProgress: false };
  }
}
