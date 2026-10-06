import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const web = createRequire(new URL('../../../../apps/web/package.json', import.meta.url));
const workspace = createRequire(new URL('../../../../package.json', import.meta.url));
// Real installed JS entries; declarations are not runtime aliases. No donor paths.
const packages = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client',
  '@radix-ui/react-dialog', '@radix-ui/react-slot', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'];
const entries = packages.map(name => [name, web.resolve(name)]);
entries.push(['@flow/client', join(root, 'packages/client/src/index.ts')],
  ['@flow/contracts', join(root, 'packages/contracts/src/index.ts')],
  ['vitest', join(dirname(workspace.resolve('vitest/package.json')), 'dist/index.js')]);
const exact = name => new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
if (!process.env.FLOW_MSGQUICK_SCRATCH) throw new Error('Caller-owned scratch is required');
export default {
  root, cacheDir: join(process.env.FLOW_MSGQUICK_SCRATCH, 'vite'),
  resolve: { alias: entries.map(([name, replacement]) => ({ find: exact(name), replacement })) },
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: { include: ['apps/web/test/message-settings.test.ts'], watch: false, cache: false,
    maxWorkers: 1, fileParallelism: false, pool: 'forks', environment: 'node', css: false },
};
