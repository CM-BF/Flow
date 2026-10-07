import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const pg = '/private/tmp/flow-svc06b-artifact-IhwFGS/backend-artifacts/cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b/root/node_modules/.pnpm/pg@8.23.1/node_modules/pg/esm/index.mjs';
const hook = registerHooks({ resolve(specifier, context, next) { return next(specifier === 'pg' ? pathToFileURL(pg).href : specifier, context); } });
try {
  assert.equal(process.permission.has('fs.read', '/Users/citrine/.flow-personal'), false);
  assert.equal(process.permission.has('fs.write'), false);
  assert.equal(process.permission.has('child'), false);
  const preview = await import('../../../../tools/personal-preview/preview.mjs');
  assert.equal(typeof preview.runService, 'function');
  assert.equal(typeof preview.loadPreviewConfiguration, 'function');
  assert.equal(typeof preview.startPreviewServices, 'function');
  console.log(JSON.stringify({ outcome: 'real-preview-import', exports: 3, operationalCalls: 0, personalReadAllowed: false, writeAllowed: false, childAllowed: false }));
} finally { hook.deregister(); }
