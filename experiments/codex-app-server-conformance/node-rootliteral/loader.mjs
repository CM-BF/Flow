// Synchronous, host-only resolver. Native Node transform-types handles the unchanged TS sources.
import { registerHooks } from 'node:module';
const directory = new URL('../../../apps/runner/src/codex/', import.meta.url).href;
const modules = new Set(['index', 'options', 'types', 'framing', 'writer', 'stderr-capture']);
export function resolveR06(specifier, context, nextResolve) {
  const parent = context.parentURL;
  if (typeof parent === 'string' && [...modules].some(name => parent === `${directory}${name}.ts`) && !specifier.startsWith('node:')) {
    const match = /^\.\/([a-z-]+)\.js$/.exec(specifier);
    if (!match || !modules.has(match[1])) throw Error('Unbound R06 module');
    return nextResolve(`${directory}${match[1]}.ts`, context);
  }
  return nextResolve(specifier, context);
}
let registered = false;
export function registerR06Loader() {
  if (registered) return;
  registerHooks({ resolve: resolveR06 }); registered = true;
}
