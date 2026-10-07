import { decodePluginRunnerClaimResponse, pluginRunnerClaimRequestSchema, type PluginRunnerClaimRequest } from '../../contracts/src/plugin-runner-claim.js';
import { pluginGrantReceiptSchema, pluginGrantRequestSchema, pluginHostPublicationSchema, type PluginGrantRequest, type PluginHostPublication } from '../../contracts/src/plugin-runtime.js';

/** Supplied by the existing FlowClient request owner; this module has no fetch/auth/retry loop. */
export type PluginJsonRequest = (path: string, init: RequestInit, maximumResponseBytes: number) => Promise<unknown>;
export class PluginRunnerClient {
  constructor(private readonly request: PluginJsonRequest) {}

  claim(input: PluginRunnerClaimRequest, signal?: AbortSignal) { return this.opportunity(input, 'claim', signal); }
  status(input: PluginRunnerClaimRequest, signal?: AbortSignal) { return this.opportunity(input, 'status', signal); }

  async publishHost(input: PluginHostPublication, signal?: AbortSignal): Promise<void> {
    const publication = pluginHostPublicationSchema.parse(input);
    const response = await this.request('/api/runner/plugin-host', { method: 'POST', body: JSON.stringify(publication), signal }, 1024);
    if (!response || typeof response !== 'object' || Object.keys(response).length !== 1
      || !('published' in response) || response.published !== true) throw new Error('Plugin host acknowledgement is unknown.');
  }

  async authorize(input: PluginGrantRequest, key: string, signal?: AbortSignal) {
    const expected = pluginGrantRequestSchema.parse(input);
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Plugin phase requires its stable identity key.');
    const value = await this.request('/api/runner/plugin-tool/authorize', { method: 'POST', body: JSON.stringify(expected),
      headers: { 'Idempotency-Key': key }, signal }, 65_536);
    const receipt = pluginGrantReceiptSchema.parse(value);
    if (receipt.attemptId !== expected.attemptId || receipt.ownerVersion !== expected.ownerVersion
      || receipt.bindingId !== expected.bindingId || receipt.invocationId !== expected.invocationId || receipt.phase !== expected.phase) {
      throw new Error('Plugin phase acknowledgement is unknown.');
    }
    return receipt;
  }

  private async opportunity(input: PluginRunnerClaimRequest, operation: 'claim' | 'status', signal?: AbortSignal) {
    const expected = pluginRunnerClaimRequestSchema.parse(input);
    const value = await this.request('/api/runner/claim-opportunity' + (operation === 'status' ? '/status' : ''),
      { method: 'POST', body: JSON.stringify(expected), signal }, 131_072);
    return decodePluginRunnerClaimResponse(value, expected, operation);
  }
}
