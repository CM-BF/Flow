import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

export async function startFixture({ sourceRoot, dependencyRoot, runDirectory }) {
  const require = createRequire(`${dependencyRoot}/package.json`);
  const webRequire = createRequire(`${dependencyRoot}/apps/web/package.json`);
  const { register } = await import(pathToFileURL(require.resolve('tsx/esm/api')));
  const unregister = register();
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@flow/contracts' || specifier === '@flow/client') return nextResolve(pathToFileURL(`${sourceRoot}/packages/${specifier.slice(6)}/src/index.ts`).href, context);
    return nextResolve(specifier, context);
  } });
  const { createConversationFixture } = await import(pathToFileURL(`${sourceRoot}/apps/web/test/conversation.fixture.ts`));
  const { installStreamFixture } = await import(pathToFileURL(`${sourceRoot}/apps/web/test/conversation-stream-integration.fixture.ts`));
  const { profileFixture } = await import(pathToFileURL(`${sourceRoot}/apps/web/test/execution-profile-integration.fixture.ts`));
  const { createServer } = await import(pathToFileURL(webRequire.resolve('vite')));
  const { default: react } = await import(pathToFileURL(webRequire.resolve('@vitejs/plugin-react')));
  const { default: tailwind } = await import(pathToFileURL(webRequire.resolve('@tailwindcss/vite')));
  const profile = profileFixture(1, 'CHATUI01');
  const fixture = createConversationFixture(); fixture.setReplyDelay(600000);
  const stream = installStreamFixture(fixture, 'CHATUI01');
  const handler = fixture.server.listeners('request')[0]; fixture.server.removeAllListeners('request');
  fixture.server.on('request', (request, response) => {
    if (request.url?.split('?')[0] === '/api/execution-profiles') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ profiles: [profile], nextCursor: null })); return;
    }
    handler(request, response);
  });
  let web;
  try {
    await new Promise(resolve => fixture.server.listen(0, '127.0.0.1', resolve));
    const centerUrl = `http://127.0.0.1:${fixture.server.address().port}`;
    web = await createServer({ root: `${sourceRoot}/apps/web`, configFile: false,
      plugins: [react(), tailwind()], cacheDir: `${runDirectory}/vite-cache`,
      define: { 'import.meta.env.VITE_FLOW_FIXTURE': 'false' },
      resolve: { alias: { '@flow/client': `${sourceRoot}/packages/client/src/index.ts`, '@flow/contracts': `${sourceRoot}/packages/contracts/src/index.ts` } },
      server: { host: '127.0.0.1', port: 0, strictPort: true, proxy: { '/api': centerUrl } },
    });
    await web.listen(); const webUrl = `http://127.0.0.1:${web.httpServer.address().port}`;
    const read = async path => {
      assert.ok(/^\/api\/(conversations\/[^/]+(?:\/turns)?|tasks\/[^/]+\/assistant-stream(?:\/patches)?)\??/.test(path), 'Driver read must stay on typed conversation/stream endpoints.');
      const response = await fetch(centerUrl + path, { headers: { authorization: 'Bearer flow-fixture-only' }, signal: AbortSignal.timeout(3000) });
      assert.equal(response.ok, true, `Fixture typed read failed: ${response.status}`); return response.json();
    };
    return { fixture, stream, profile, read, webUrl, centerUrl, close: async () => {
      stream.close(); await web.close(); await fixture.close(); hooks.deregister(); unregister();
    } };
  } catch (error) { stream.close(); await web?.close(); await fixture.close(); hooks.deregister(); unregister(); throw error; }
}
