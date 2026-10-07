import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
const root=fileURLToPath(new URL('./host-candidates-inputs/',import.meta.url));
const base=fileURLToPath(new URL('./process-runner-inputs/',import.meta.url));
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;
if(!cacheDir?.startsWith('/'))throw Error('Owned cache required');
export default {root,cacheDir,resolve:{alias:{'@flow/contracts':resolve(base,'packages/contracts/src/index.ts'),'@flow/plugin-runtime':resolve(base,'packages/plugin-runtime/src/package-store.ts'),'@flow/client':resolve(base,'packages/client/src/index.ts')}},plugins:[{name:'fixed-existing-closure-overlay',enforce:'pre',resolveId(source,importer){
 if(!importer||!source.startsWith('.'))return;
 const target=resolve(dirname(importer),source).replace(/\.js$/,'.ts');
 const prefix=target.startsWith(root)?root:target.startsWith(base)?base:null;if(!prefix)return;
 const rel=relative(prefix,target);const own=resolve(root,rel);const fixed=resolve(base,rel);
 if(existsSync(own))return own;if(existsSync(fixed))return fixed;
}}],test:{include:['apps/server/src/plugin-runtime/host-candidates.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:5000,hookTimeout:5000}};
