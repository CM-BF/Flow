import { readFile, lstat, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { loadPreviewConfiguration, readPreviewJson, statusPreview, assertPreviewMarker } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/preview.mjs';
import { inspectOwnedProcess, ownsListener } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/process.mjs';
import { verifyWebArtifact } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-artifact.mjs';
const root='/Users/citrine/Projects/AgentHarness/Flow', privateRoot='/Users/citrine/.flow-personal';
const target='362af3bac77541e5a60979326bcf4d4b8c947915', label=process.argv[2], baselineFile=process.argv[3];
if(!/^[a-z0-9-]+$/.test(label??''))throw Error('LABEL');
const output=new URL('./'+label+'.json',import.meta.url), exec=promisify(execFile), sha=b=>createHash('sha256').update(b).digest('hex');
const q=s=>'"'+s.replaceAll('"','""')+'"';
const result={at:new Date().toISOString(),label,target,operatorQueries:0};let pool;let phase='source';
try {
 result.source={head:(await exec('git',['-C',root,'rev-parse','HEAD'])).stdout.trim(),dirty:Boolean((await exec('git',['-C',root,'status','--porcelain'])).stdout.trim())};
 const config=await loadPreviewConfiguration(privateRoot);await assertPreviewMarker(config);
 phase='private-file-identity';result.private={files:{}};
 for(const file of ['config.json','claude.json','web-release.json']){const path=join(privateRoot,file), bytes=await readFile(path), st=await lstat(path);result.private.files[file]={bytes:bytes.length,sha256:sha(bytes),mode:st.mode&0o777,owned:st.uid===process.getuid(),regular:st.isFile()&&!st.isSymbolicLink()};}
 const native=await readPreviewJson(join(privateRoot,'claude.json'));
 result.private.nativeMatches=JSON.stringify(native)===JSON.stringify({model:'claude-sonnet-5-5',materialFiles:[],allowRead:false,requireReadApproval:false,maxTurns:2,maxBudgetUsd:0.2,timeoutMs:60000});
 result.private.lockPresent=await lstat(join(privateRoot,'operation.lock')).then(()=>true,e=>e.code==='ENOENT'?false:Promise.reject(e));
 const runnerStat=await lstat(join(privateRoot,'runner'));const files=[];
 async function walk(dir,prefix=''){for(const name of(await readdir(dir)).sort()){const path=join(dir,name),st=await lstat(path);if(st.isSymbolicLink())throw Error('RUNNER_SYMLINK');if(st.isDirectory())await walk(path,prefix+name+'/');else if(st.isFile())files.push({path:prefix+name,bytes:st.size,sha256:sha(await readFile(path))});}}
 await walk(join(privateRoot,'runner'));result.private.runnerDirectory={device:runnerStat.dev,inode:runnerStat.ino,mode:runnerStat.mode&0o777,files};
 phase='owned-processes';const state=await readPreviewJson(join(privateRoot,'state.json'));result.status=await statusPreview({directory:privateRoot});delete result.status.credentialsFile;
 result.processes={};for(const role of['center','runner','web']){const p=state.processes[role];result.processes[role]={identity:await inspectOwnedProcess(p),pid:p.pid,group:p.group,startedAt:p.startedAt};}
 result.listeners={center:await ownsListener(state.processes.center,config.centerPort),web:await ownsListener(state.processes.web,config.webPort)};
 const ps=(await exec('ps',['-ax','-o','pid=','-o','ppid=','-o','pgid=','-o','command='])).stdout.split('\n');
 result.runnerEntrypoints=ps.flatMap(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);return m&&m[4].includes('apps/runner/src/main.ts')&&!m[4].includes('ps -ax')?[{pid:+m[1],parent:+m[2],group:+m[3],ownedGroup:+m[3]===state.processes.runner.group}]:[];});
 phase='artifacts';const release=await readPreviewJson(join(privateRoot,'web-release.json'));result.release=release;
 result.artifacts=[];for(const artifact of release.artifacts){await verifyWebArtifact({directory:privateRoot,artifact});result.artifacts.push({...artifact,verified:true});}
 phase='dependencies';result.dependencies=[];
 for(const role of ['server','runner','web']){const manifest=JSON.parse(await readFile(join(root,'apps',role,'package.json'),'utf8')),require=createRequire(join(root,'apps',role,'package.json'));
 for(const[name,version]of Object.entries(manifest.dependencies??{})){if(name.startsWith('@flow/'))continue;let resolved;try{resolved=require.resolve(name);}catch{result.dependencies.push({role,name,expected:version,resolved:false});continue;}result.dependencies.push({role,name,expected:version,resolved:resolved.startsWith(root+'/node_modules/.pnpm/'),path:resolved});}}
 phase='database';const {Pool}=createRequire(join(root,'apps/server/package.json'))('pg');pool=new Pool({connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:2000,statement_timeout:5000,application_name:'svc05-read-only'});
 const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const rows=async(sql,p)=>(await c.query(sql,p)).rows;
 result.database={};const db=result.database;db.runnerId=config.runner.runnerId;
 db.identityMatches=(await rows('SELECT id FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked',[config.runner.runnerId,sha(config.runner.token)])).length===1;
 db.tasks=await rows('SELECT status,count(*)::int AS count FROM flow.tasks GROUP BY status ORDER BY status');db.unfinished=await rows('SELECT a.id,a.task_id,a.runner_id,a.owner_version,t.status FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id WHERE a.completed_at IS NULL ORDER BY a.id');
 db.queue=await rows('SELECT state,count(*)::int AS count FROM flow.conversation_queue GROUP BY state ORDER BY state');
 db.runners=await rows('SELECT id,harnesses,capacity,revoked,maintenance_state,maintenance_version,maintenance_operation_id,maintenance_updated_at FROM flow.runners ORDER BY id');
 db.retainedConversation=(await rows('SELECT id,revision FROM flow.conversations WHERE id=$1',['2c507833-67fe-4d10-acf5-6c97eedd05bb']))[0]??null;
 db.tables={};const baseline=baselineFile?JSON.parse(await readFile(baselineFile,'utf8')):null;
 for(const{name}of await rows("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='flow' AND table_type='BASE TABLE' ORDER BY table_name")){
 const columns=(await rows("SELECT column_name AS name FROM information_schema.columns WHERE table_schema='flow' AND table_name=$1 ORDER BY ordinal_position",[name])).map(r=>r.name);
 const omitted=name==='conversations'?['queue_checked_at']:name==='runners'?['maintenance_state','maintenance_version','maintenance_operation_id','maintenance_updated_at']:[];
 const selected=baseline?.database.tables[name]?.columns??columns;
 const keep=selected.filter(k=>!omitted.includes(k));if(keep.some(k=>!columns.includes(k)))throw Error('OLD_COLUMN_REMOVED');
 const count=(await rows(`SELECT count(*)::int AS n FROM flow.${q(name)}`))[0].n;if(count>50000)throw Error('TABLE_CAPTURE_BOUND');
 const hashes=await rows(`SELECT md5(to_jsonb(x)::text) AS digest FROM (SELECT ${keep.map(q).join(',')} FROM flow.${q(name)}) x ORDER BY digest`);
 db.tables[name]={columns,omitted,count,digests:hashes.map(r=>r.digest)};
 }
 db.migrations=await rows('SELECT * FROM flow.migrations ORDER BY version');
 db.audit=await rows('SELECT ordinal,id,result FROM flow.runner_maintenance_audit WHERE runner_id=$1 ORDER BY ordinal',[config.runner.runnerId]);
 db.additive={};
 if(db.tables.assistant_messages.columns.includes('native_source_identity'))db.additive.assistantNativeIdentityNonNull=(await rows('SELECT count(*)::int AS n FROM flow.assistant_messages WHERE native_source_identity IS NOT NULL'))[0].n;
 if(db.tables.conversation_contexts.columns.includes('attachments'))db.additive.contextAttachmentsNonempty=(await rows("SELECT count(*)::int AS n FROM flow.conversation_contexts WHERE attachments <> '[]'::jsonb"))[0].n;
 await c.query('COMMIT');}finally{c.release();}
 result.operation=await readPreviewJson(join(privateRoot,'maintenance.json'));result.operation={operationId:result.operation.operationId,phase:result.operation.phase,target:result.operation.target,resumeVersion:result.operation.resumeVersion};
 result.outcome='observed';result.limits=['Instant read-only snapshot, not admission lock.','Known installation, authoritative identity, full local runner entrypoint and whole-database unfinished inventory; no proof of arbitrary remote deployment.','Old field digests omit only conversations.queue_checked_at and four explicitly expected runner maintenance columns.','Provider not probed; no user task created/retried/cancelled.'];
}catch(e){result.outcome='unknown';result.phase=phase;result.errorCode=/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'OBSERVATION_UNCONFIRMED';process.exitCode=1;}finally{await pool?.end();}
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({label,outcome:result.outcome,phase:result.phase,source:result.source,unfinished:result.database?.unfinished.length,tasks:result.database?.tasks,queue:result.database?.queue,dependenciesUnresolved:result.dependencies?.filter(d=>!d.resolved).map(d=>d.name)}));
