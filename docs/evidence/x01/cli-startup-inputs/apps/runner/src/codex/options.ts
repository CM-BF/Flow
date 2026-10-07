import { isAbsolute } from 'node:path';
import { CodexTransportError, type Limits, type TransportOptions } from './types.js';
const defaults: Limits = {
  frameBytes: 1024 * 1024, outboundBytes: 2 * 1024 * 1024, outboundFrames: 64,
  inboundBytes: 2 * 1024 * 1024, inboundFrames: 64, pendingRequests: 32, serverRequests: 32,
  requestTimeoutMs: 15_000, initializeTimeoutMs: 10_000, terminateMs: 1000, killMs: 1000,
};
const maxima: Limits = {
  frameBytes: 4 * 1024 * 1024, outboundBytes: 8 * 1024 * 1024, outboundFrames: 256,
  inboundBytes: 8 * 1024 * 1024, inboundFrames: 256, pendingRequests: 128, serverRequests: 128,
  requestTimeoutMs: 90_000, initializeTimeoutMs: 30_000, terminateMs: 5000, killMs: 5000,
};
const allowedEnvironment = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'CODEX_HOME']);
export function validText(value: unknown, maximum = 512): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\x00-\x1f]/.test(value);
}
export function normalizeOptions(options: TransportOptions): { options: TransportOptions; limits: Limits } {
  const fail = () => { throw new CodexTransportError('INVALID_OPTIONS', 'not-sent'); };
  const spawn = options?.spawn;
  if (!spawn || !validText(spawn.executable, 4096) || !isAbsolute(spawn.executable) || !validText(spawn.cwd, 4096) || !isAbsolute(spawn.cwd)
    || !Array.isArray(spawn.args) || spawn.args.length > 64 || spawn.args.some(arg => typeof arg !== 'string' || arg.length > 8192 || arg.includes('\0'))
    || !spawn.environment || Object.entries(spawn.environment).some(([key, value]) => !allowedEnvironment.has(key) || typeof value !== 'string' || value.length > 8192 || value.includes('\0'))) fail();
  const info = options.initialize?.clientInfo;
  if (!info || !validText(info.name) || !validText(info.version) || !(info.title === null || validText(info.title))) fail();
  const capabilities = options.initialize?.capabilities;
  if (capabilities !== null && (!capabilities || typeof capabilities.experimentalApi !== 'boolean' || typeof capabilities.requestAttestation !== 'boolean'
    || Object.keys(capabilities).some(key => !['experimentalApi', 'requestAttestation', 'optOutNotificationMethods'].includes(key))
    || capabilities.optOutNotificationMethods !== undefined && (!Array.isArray(capabilities.optOutNotificationMethods) || capabilities.optOutNotificationMethods.length > 128 || capabilities.optOutNotificationMethods.some(method => !validText(method))))) fail();
  const limits = { ...defaults };
  for (const [key, value] of Object.entries(options.limits ?? {})) {
    if (!Object.hasOwn(maxima, key) || !Number.isSafeInteger(value) || value <= 0 || value > maxima[key as keyof Limits]) fail();
    limits[key as keyof Limits] = value;
  }
  const sink = options.privateStderr;
  let privateStderr: TransportOptions['privateStderr'];
  try { privateStderr = sink === undefined ? undefined : { maxBytes: sink.maxBytes, write: sink.write }; }
  catch { fail(); }
  if (privateStderr !== undefined && (!Number.isSafeInteger(privateStderr.maxBytes) || privateStderr.maxBytes <= 0 || privateStderr.maxBytes > 65536 || typeof privateStderr.write !== 'function')) fail();
  const initialize: TransportOptions['initialize'] = { clientInfo: { name: info.name, title: info.title, version: info.version }, capabilities: capabilities === null ? null : { experimentalApi: capabilities.experimentalApi, requestAttestation: capabilities.requestAttestation, ...(capabilities.optOutNotificationMethods === undefined ? {} : { optOutNotificationMethods: [...capabilities.optOutNotificationMethods] }) } };
  return { options: { ...options, privateStderr, initialize, spawn: { ...spawn, args: [...spawn.args], environment: { ...spawn.environment } } }, limits };
}
