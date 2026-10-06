import { request } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectOwnedProcess, ownsListener } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/tools/personal-preview/process.mjs';
const output='/tmp/flow-svc05h-identity-once.json';
const state=JSON.parse(await readFile('/Users/citrine/.flow-personal/state.json','utf8'));
const record=state.processes.web;
const result={at:new Date().toISOString(),method:'GET',url:'http://127.0.0.1:61228/__flow_preview_identity',requests:0,redirectsFollowed:0,limitMs:2000,maxBodyBytes:4096,owned:{pid:record.pid,group:record.group,identity:await inspectOwnedProcess(record),listener:await ownsListener(record,61228)}};
function errorFacts(error){if(!error)return null;return {name:error.name??null,code:error.code??null,errno:error.errno??null,syscall:error.syscall??null,cause:error.cause?errorFacts(error.cause):null};}
if(result.owned.identity!=='running'||!result.owned.listener)result.outcome='identity-unknown-no-request';
else {
 result.requests=1;
 await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
 const req=request(result.url,{method:'GET',agent:false,headers:{accept:'application/json'}},res=>{result.status=res.statusCode;result.contentType=res.headers['content-type']??null;result.contentLength=res.headers['content-length']??null;result.locationType=res.headers.location?(res.headers.location.startsWith('/')?'relative':'other'):null;let total=0;const chunks=[];res.on('data',b=>{total+=b.length;if(total>4096){result.outcome='body-bound-exceeded';res.destroy();req.destroy();finish();}else chunks.push(b);});res.on('end',()=>{const b=Buffer.concat(chunks);result.bodyBytes=b.length;result.bodySha256=createHash('sha256').update(b).digest('hex');try{const j=JSON.parse(b.toString());result.bodyType='json';result.identity=Object.fromEntries(['artifactId','sourceHead','manifestDigest','releaseVersion','releasePolicy'].filter(k=>typeof j[k]==='string'||typeof j[k]==='number').map(k=>[k,j[k]]));}catch{result.bodyType=b.length===0?'empty':/^\s*</.test(b.toString())?'markup':'non-json';}result.outcome='response-received';finish();});res.on('error',e=>{result.outcome='response-error';result.error=errorFacts(e);finish();});});
 req.on('error',e=>{result.outcome='request-error';result.error=errorFacts(e);finish();});const timer=setTimeout(()=>{result.outcome='deadline';req.destroy(Object.assign(new Error('READ_DEADLINE'),{code:'READ_DEADLINE'}));finish();},2000);req.end();});
}
await writeFile(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify(result));
