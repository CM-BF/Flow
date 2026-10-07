import compare from '/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/semver@7.8.5/node_modules/semver/functions/compare.js';
export const hostApiMajor = 1;
export function invoke({ input }) {
  if (typeof input !== 'string' || new TextEncoder().encode(input).length > 4096) throw new TypeError('Invalid compare input');
  const value = JSON.parse(input);
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'left,right'
    || [value.left, value.right].some(version => typeof version !== 'string' || new TextEncoder().encode(version).length > 256)) throw new TypeError('Expected bounded left/right versions');
  return String(compare(value.left, value.right));
}
