import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const pg = '/private/tmp/flow-svc06b-artifact-IhwFGS/backend-artifacts/cd27b441d9e95c0e972bc6a502c74d1f22dc0041f0398c7f099f4a1372bcab6b/root/node_modules/.pnpm/pg@8.23.1/node_modules/pg/esm/index.mjs';
registerHooks({resolve(specifier,context,next){return next(specifier==='pg'?pathToFileURL(pg).href:specifier,context);}});
