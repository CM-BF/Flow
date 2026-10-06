import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const owner = "/Users/citrine/Projects/AgentHarness/Flow-worktrees/context-transparency";
const dependency = createRequire("/Users/citrine/Projects/AgentHarness/Flow/apps/runner/package.json");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (['@flow/contracts', '@flow/client', '@flow/protocols'].includes(specifier))
    return nextResolve(pathToFileURL(`${owner}/packages/${specifier.slice(6)}/src/index.ts`).href, context);
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes(':')) throw error;
    return nextResolve(pathToFileURL(dependency.resolve(specifier)).href, context);
  }
} });
