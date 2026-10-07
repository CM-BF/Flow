import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = fileURLToPath(new URL('../../../',import.meta.url));
const database = resolve(root,'apps/server/src/database.ts');
const donor = resolve(root,'docs/evidence/x01/center-claim-database.ts');
if(createHash('sha256').update(readFileSync(donor)).digest('hex')!=='277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653')throw new Error('Fixed main database changed');
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;
if(!cacheDir?.startsWith('/'))throw new Error('Owned cache required');
export default { root, cacheDir, plugins:[{name:'fixed-main-database',enforce:'pre',resolveId(source,importer){
  if(importer&&source.startsWith('.')&&resolve(dirname(importer),source).replace(/\.js$/,'.ts')===database)return donor;
},transform(code,id){if(id===donor)return code+"\nprocess.stdout.write('X01_FIXED_MAIN_DATABASE_LOADED\\n');\n";}}],
 test:{include:['apps/server/src/plugin-runtime/claim.test.ts','apps/server/src/runner-claim-routes.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:5000,hookTimeout:5000}};
