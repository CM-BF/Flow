import {readFile,access} from 'node:fs/promises';import {join} from 'node:path';import {createHash} from 'node:crypto';import {Pool} from 'pg';
import {inspectOwnedProcess} from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/process.mjs';
import {readWebRelease} from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-release.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),directory='/Users/citrine/.flow-personal';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const config=await read(join(directory,'config.json')),state=await read(join(directory,'state.json')),release=await readWebRelease(directory),before=await read(new URL('./personal-stage.json',import.meta.url));
const processes={};for(const role of ['center','runner','web'])processes[role]={pid:state.processes[role].pid,identity:await inspectOwnedProcess(state.processes[role])};
if(processes.center.pid!==before.processes.center||processes.runner.pid!==before.processes.runner||state.source.head!==before.source)throw Error('Backend changed');
const configurationUnchanged=hash(await readFile(join(directory,'config.json')))===before.configurationDigest;
const nativeConfigurationUnchanged=hash(await readFile(join(directory,'claude.json')))===before.nativeConfigurationDigest;
if(!configurationUnchanged||!nativeConfigurationUnchanged)throw Error('Configuration changed');
const pool=new Pool({connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:1500,statement_timeout:2000});let work,maintenance;
try{await pool.query('BEGIN READ ONLY');work={tasks:(await pool.query('SELECT status,count(*)::int AS count FROM flow.tasks GROUP BY status ORDER BY status')).rows,unfinishedAttempts:(await pool.query('SELECT runner_id,count(*)::int AS count FROM flow.attempts WHERE completed_at IS NULL GROUP BY runner_id')).rows};maintenance=(await pool.query('SELECT id,capacity,revoked,maintenance_state,maintenance_version FROM flow.runners ORDER BY id')).rows;await pool.query('COMMIT');}finally{await pool.end();}
if(JSON.stringify(maintenance)!==JSON.stringify(before.maintenance))throw Error('Maintenance changed');
const base=`http://127.0.0.1:${config.webPort}`;
const response=await fetch(base+'/__flow_preview_identity',{signal:AbortSignal.timeout(1500)}),identity=await response.json();
if(response.status!==200||identity.artifactId!==release.current||identity.releaseVersion!==release.version)throw Error('Web identity mismatch');
const assets=[];
for(const artifact of release.artifacts){const manifest=await read(join(directory,'web-artifacts',artifact.artifactId,'manifest.json'));const namespace=manifest.format===2?`/__flow_releases/${manifest.releaseId}/`:'/';for(const file of manifest.files){if(file.path==='index.html'&&artifact.artifactId!==release.current&&namespace==='/')continue;const path=namespace+file.path;const response=await fetch(base+path,{signal:AbortSignal.timeout(2000)});const bytes=Buffer.from(await response.arrayBuffer());const match=response.status===200&&bytes.length===file.bytes&&hash(bytes)===file.sha256;assets.push({path,status:response.status,bytes:bytes.length,matches:match});if(!match)throw Error('Asset mismatch');}}
const current=release.artifacts.find(a=>a.artifactId===release.current),manifest=await read(join(directory,'web-artifacts',current.artifactId,'manifest.json'));const index=manifest.files.find(f=>f.path==='index.html');const root=await fetch(base+'/',{signal:AbortSignal.timeout(2000)});const rootBytes=Buffer.from(await root.arrayBuffer());if(root.status!==200||hash(rootBytes)!==index.sha256)throw Error('Entry mismatch');
let operationLockPresent=true;try{await access(join(directory,'operation.lock'));}catch(e){if(e.code!=='ENOENT')throw e;operationLockPresent=false;}
console.log(JSON.stringify({observedAt:new Date().toISOString(),releaseVersion:release.version,current,backend:state.source,processes,maintenance,configurationUnchanged,nativeConfigurationUnchanged,ports:{center:config.centerPort,web:config.webPort},work,webIdentity:identity,assets,rootIndex:{status:root.status,matches:true},operationLockPresent,operatorProviderQueries:0,userTabReloads:0}));
