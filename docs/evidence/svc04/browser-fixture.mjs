// Zero-provider, disposable real Vite builds and loopback proxy for browser concurrency observation.
import { mkdtemp, mkdir, writeFile, readFile, realpath, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, request as forward } from 'node:http';
import { createInterface } from 'node:readline';
import { prepareWebArtifact } from '../../../tools/personal-preview/web-artifact.mjs';
import { importWebCompatibility, planWebRelease, commitWebRelease } from '../../../tools/personal-preview/web-release.mjs';
import { startStaticWeb } from '../../../tools/personal-preview/static-web.mjs';
const execute = promisify(execFile); const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fileURLToPath(new URL('../../../', import.meta.url)); const parent = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc04-browser-')));
const directory = join(parent, 'state'); const repository = join(parent, 'source'); const captures = []; let web;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
const center = createServer((_request, response) => { response.writeHead(404); response.end(); });
const proxy = createServer((request, response) => {
  const upstream = forward({ host: '127.0.0.1', port: webPort, path: request.url, method: request.method, headers: request.headers }, incoming => {
    let bytes = 0; incoming.on('data', chunk => { bytes += chunk.length; });
    incoming.on('end', () => captures.push({ path: request.url, status: incoming.statusCode, bytes }));
    response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
  });
  upstream.on('error', () => { response.statusCode = 502; response.end(); }); request.pipe(upstream);
});
const centerPort = await listen(center); const reservation = createServer(); const webPort = await listen(reservation); await close(reservation);
const backendHead = 'c'.repeat(40); const ids = {}; let release; let oldArtifact; let nextArtifact;
async function declaration(artifact) {
  const folder = join(parent, artifact.artifactId); await mkdir(folder);
  const fields = { read: ['ownerAuthenticated','conversationBound','taskBound'], send: ['acceptedTurnBound','requestedProfilePreserved'], recover: ['sameKey','sameBody','sameTurn'], negotiation: ['legacyReadable','streamHeaderHandled','profileHeaderHandled'] }; const checks = {};
  for (const [check, names] of Object.entries(fields)) {
    const bytes = JSON.stringify({ format:1, check, backendHead, artifactId:artifact.artifactId, observations:Object.fromEntries(names.map(name=>[name,true])) });
    checks[check]=sha(bytes); await writeFile(join(folder,`${check}.json`),bytes);
  }
  await writeFile(join(folder,'report.json'),JSON.stringify({format:1,policy:'flow-web-api-v1',backendHead,artifact,checks}));
  ids[artifact.artifactId]=await importWebCompatibility({directory,reportDirectory:folder});
}
async function build(version, releaseId) {
  const source = join(repository,'apps/web'); await mkdir(join(source,'chunks'),{recursive:true});
  await writeFile(join(source,'index.html'), `<html><head><meta charset="utf-8"><title>SVC04 ${version}</title></head><body><h1>SVC04 ${version}</h1><p id="status">booting</p><button id="plugins">Load plugins</button><p id="lazy">not loaded</p><pre id="errors"></pre><script>window.addEventListener('error',e=>document.querySelector('#errors').textContent+=String(e.message||e.target.src)+'\\n',true);window.addEventListener('unhandledrejection',e=>document.querySelector('#errors').textContent+=String(e.reason)+'\\n')</script><script type="module" src="/main.js"></script></body></html>`);
  for(let i=0;i<20;i++) await writeFile(join(source,`chunks/part${i}.js`),`export const value=${JSON.stringify(`${version}-${i}`)};export const payload=${JSON.stringify(randomBytes(65_536).toString('hex'))};`);
  await writeFile(join(source,'main.js'), `${Array.from({length:12},(_,i)=>`import * as c${i} from './chunks/part${i}.js';`).join('\n')}
  const cold=[${Array.from({length:12},(_,i)=>`c${i}`).join(',')}];globalThis.coldPayload=cold.map(c=>c.payload);document.querySelector('#status').textContent=${JSON.stringify(version)}+' cold '+cold.length+'/12';
  document.querySelector('#plugins').onclick=async()=>{try{const values=await Promise.all([${Array.from({length:8},(_,i)=>`import('./chunks/part${i+12}.js')`).join(',')}]);globalThis.lazyPayload=values.map(v=>v.payload);document.querySelector('#lazy').textContent=values.map(v=>v.value).join(',');}catch(e){document.querySelector('#lazy').textContent='FAILED '+String(e)}};`);
  await execute('git',['-C',repository,'add','.']); await execute('git',['-C',repository,'-c','user.name=Flow Fixture','-c','user.email=fixture@example.invalid','commit','-qm',version]);
  const target=(await execute('git',['-C',repository,'rev-parse','HEAD'])).stdout.trim();
  const artifact=await prepareWebArtifact({directory,repository,target,...(releaseId?{releaseId}:{})}); await declaration(artifact); return artifact;
}
try {
  await mkdir(directory,{mode:0o700}); await mkdir(join(repository,'apps/web'),{recursive:true});
  await writeFile(join(repository,'.gitignore'),'node_modules\n'); await writeFile(join(repository,'pnpm-lock.yaml'),'fixed installed Vite fixture'); await writeFile(join(repository,'apps/web/package.json'),'{"type":"module"}');
  await symlink(join(root,'apps/web/node_modules'),join(repository,'apps/web/node_modules'));
  await writeFile(join(repository,'apps/web/vite.config.mjs'),`export default {build:{rollupOptions:{output:{manualChunks(id){if(id.includes('/chunks/'))return id.split('/').pop().slice(0,-3)}}}}};`);
  await execute('git',['init','-q',repository]);
  oldArtifact=await build('old'); nextArtifact=await build('new','ab'.repeat(16));
  release=await planWebRelease({directory,artifact:oldArtifact,expectedVersion:0,action:'bootstrap',backendHead,compatibilityId:ids[oldArtifact.artifactId]}); await commitWebRelease(directory,release);
  web=await startStaticWeb({directory,repository:root,artifact:oldArtifact,webPort,centerPort}); const port=await listen(proxy);
  console.log(JSON.stringify({event:'ready',url:`http://127.0.0.1:${port}`,oldArtifact,nextArtifact,fixtureOnly:true,providerQueries:0}));
  const input=createInterface({input:process.stdin});
  for await(const line of input){
    const action=line.trim(); if(action==='quit')break;
    if(action==='publish'||action==='rollback'){
      const artifact=action==='publish'?nextArtifact:oldArtifact;
      release=await planWebRelease({directory,artifact,expectedVersion:release.version,action,backendHead,compatibilityId:ids[artifact.artifactId]}); await commitWebRelease(directory,release);
    }
    console.log(JSON.stringify({event:action,version:release.version,captures:captures.splice(0)}));
  }
} finally { await web?.close(); await close(proxy); await close(center); await rm(parent,{recursive:true,force:true}); process.stdin.pause(); console.log(JSON.stringify({event:'cleanup',removed:true,providerQueries:0})); }
