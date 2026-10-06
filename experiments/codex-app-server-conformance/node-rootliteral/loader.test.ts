import { expect, test, vi } from 'vitest';
import { resolveR06 } from './loader.mjs';
const directory = new URL('../../../apps/runner/src/codex/', import.meta.url).href;
test.each(['index', 'options', 'types', 'framing', 'writer', 'stderr-capture'])('fixed module %s maps only inside the same R06 directory', name => {
  const next = vi.fn((url: string) => url);
  expect(resolveR06(`./${name}.js`, { parentURL: `${directory}index.ts` }, next)).toBe(`${directory}${name}.ts`);
});
test.each(['../types.js', './missing.js', './types.ts', './types.js?x', './%74ypes.js', '/tmp/types.js', 'other-package'])('unknown R06 import %s is rejected', name => {
  const next = vi.fn(); expect(() => resolveR06(name, { parentURL: `${directory}index.ts` }, next)).toThrow(); expect(next).not.toHaveBeenCalled();
});
test('builtins and unrelated consumers remain on native resolution', () => {
  const next = vi.fn((url: string) => url);
  expect(resolveR06('node:fs', { parentURL: `${directory}index.ts` }, next)).toBe('node:fs');
  expect(resolveR06('./types.js', { parentURL: 'file:///elsewhere/index.ts' }, next)).toBe('./types.js');
});
