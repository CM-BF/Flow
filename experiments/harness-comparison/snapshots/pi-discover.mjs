import { ModelRuntime, getAgentDir } from '@earendil-works/pi-coding-agent';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const runtime = await ModelRuntime.create({
  authPath: path.join(getAgentDir(), 'auth.json'),
  modelsPath: null,
  modelsStorePath: '/tmp/flow-pi-eval.yxI5qW/models-cache.json',
  allowModelNetwork: false,
  signal: AbortSignal.timeout(15000),
});
const available = runtime.getAvailableSnapshot();
const ranked = [...available].sort((a,b) => {
  const rank = m => m.provider === 'anthropic' && /sonnet/i.test(m.id) ? (m.id.includes('4-6') || m.id.includes('4.6') ? 0 : 1) : m.provider === 'openai-codex' ? 3 : 5;
  return rank(a)-rank(b);
});
const chosen = ranked[0];
const result = { availableCount: available.length, authenticatedProviders: [...new Set(available.map(m=>m.provider))], chosen: chosen ? {provider:chosen.provider, model:chosen.id, oauth:runtime.isUsingOAuth(chosen.provider), subscription:runtime.isUsingSubscription(chosen.provider)} : null };
await writeFile('/tmp/flow-pi-eval.yxI5qW/discovery.json', JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
