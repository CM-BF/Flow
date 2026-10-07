import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname,resolve,relative } from 'node:path';
const overlay=fileURLToPath(new URL('./terminal-inputs/',import.meta.url));
const base=fileURLToPath(new URL('./public-runner-inputs/',import.meta.url));
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;
if(!cacheDir?.startsWith('/'))throw new Error('Owned cache required');
export default {root:overlay,cacheDir,plugins:[{name:'fixed-terminal-delta',enforce:'pre',resolveId(source,importer){
  if(!importer||!source.startsWith('.'))return;
  const parent=importer.startsWith(overlay)?overlay:importer.startsWith(base)?base:undefined;
  if(!parent)return;
  const name=relative(parent,resolve(dirname(importer),source)).replace(/\.js$/,'.ts');
  if(name.startsWith('..'))throw new Error('Input escaped fixed roots');
  for(const root of [overlay,base]){const path=resolve(root,name);if(existsSync(path))return path;}
}}],resolve:{alias:{'@flow/client':resolve(base,'packages/client/src/index.ts'),'@flow/contracts':resolve(base,'packages/contracts/src/index.ts'),'@flow/plugin-runtime':resolve(base,'packages/plugin-runtime/src/package-store.ts')}},
test:{testNamePattern:'terminal|unknown phase ACK|unknown package outcome|ordinary v3|v3 claim persists|flushes the durable prefix',include:['apps/runner/src/plugins/runtime.test.ts','apps/runner/src/plugins/terminal-outbox.test.ts','apps/runner/src/outbox.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:3000,hookTimeout:3000}};
