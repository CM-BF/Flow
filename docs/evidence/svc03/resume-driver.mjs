import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
const repository='/Users/citrine/Projects/AgentHarness/Flow';
const directory='/Users/citrine/.flow-personal';
const target='b1c2e39837c2208e6fc2c59a80e16797f26448b5';
const deadline=Date.parse('2026-10-06T09:10:00Z');
const output='/tmp/flow-svc03-window-resume-result.json';
const execute=promisify(execFile);const require=createRequire(join(repository,'package.json'));const {Pool}=require('pg');
const {loadPreviewConfiguration,readPreviewJson,withPreviewLock,statusPreview}=await import(`${repository}/tools/personal-preview/preview.mjs`);
const {prepareWebArtifact,verifyWebArtifact}=await import(`${repository}/tools/personal-preview/web-artifact.mjs`);
const {inspectOwnedProcess,ownsListener}=await import(`${repository}/tools/personal-preview/process.mjs`);
const {baseServiceEnvironment}=await import(`${repository}/tools/personal-preview/environment.mjs`);
const result={target,authorization:'Execution Lead authorized one SVC03 update and one explicit resume if every fresh gate passes; window ends 2026-10-06T09:10:00Z.',startedAt:new Date().toISOString(),providerCalls:0,tabReloads:0,actions:[]};
const fail=code=>{throw Object.assign(new Error(code),{code});};
async function save(){await writeFile(output+'.tmp',JSON.stringify(result,null,2)+'\n');await rename(output+'.tmp',output);}
async function source(){if(Date.now()>deadline)fail('WINDOW_EXPIRED');const head=(await execute('git',['-C',repository,'rev-parse','HEAD'])).stdout.trim();const remote=(await execute('git',['-C',repository,'rev-parse','origin/main'])).stdout.trim();const dirty=(await execute('git',['-C',repository,'status','--porcelain'])).stdout;if(head!==target||remote!==target||dirty)fail('SOURCE_NOT_FIXED_CLEAN');}
async function facts(config){
 const pool=new Pool({connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:1500,statement_timeout:2000,application_name:'flow-svc03-window-readonly'});
 let data;
 try {const c=await pool.connect();try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const marker=(await c.query('SELECT installation_id=$1 AND directory=$2 AS matches FROM public.flow_preview_owner',[config.installationId,directory])).rows;
  const identity=(await c.query('SELECT EXISTS(SELECT 1 FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked) AS matches',[config.runner.runnerId,createHash('sha256').update(config.runner.token).digest('hex')])).rows[0];
  const tasks=(await c.query('SELECT status,count(*)::int AS count FROM flow.tasks GROUP BY status ORDER BY status')).rows;
  const attempts=(await c.query('SELECT t.status,count(*)::int AS count FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id WHERE a.completed_at IS NULL GROUP BY t.status ORDER BY t.status')).rows;
  const queue=(await c.query('SELECT state,count(*)::int AS count FROM flow.conversation_queue GROUP BY state ORDER BY state')).rows;
  const runners=(await c.query('SELECT id=$1 AS configured,revoked,capacity,harnesses,maintenance_state,maintenance_version,maintenance_operation_id IS NOT NULL AS has_operation FROM flow.runners ORDER BY id LIMIT 1001',[config.runner.runnerId])).rows;
  const summary={};
  const selections={tasks:'SELECT id,status,verification_status,cursor,owner_version,current_attempt_id,latest_artifact_id,latest_artifact_version,updated_at FROM flow.tasks',attempts:'SELECT id,task_id,runner_id,owner_version,last_sequence,native_session_id,completed_at FROM flow.attempts',conversations:'SELECT id,revision,requested,execution_profile,queue_paused,queue_revision FROM flow.conversations',turns:'SELECT id,conversation_id,number,task_id,created_at FROM flow.conversation_turns',queue:'SELECT id,conversation_id,sequence,state,task_id,turn_id,turn_number,created_at,updated_at FROM flow.conversation_queue',profiles:'SELECT id,runner_id,config_digest FROM flow.execution_profiles',sessions:'SELECT id,harness,runner_id,active_task_id FROM flow.sessions'};
  for(const [key,sql] of Object.entries(selections))summary[key]=(await c.query(`SELECT count(*)::int AS count,md5(coalesce(string_agg(row_digest,',' ORDER BY row_digest),'')) AS metadataDigest FROM (SELECT md5(row_to_json(q)::text) AS row_digest FROM (${sql}) q) h`)).rows[0];
  const migrations=(await c.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(x=>x.version);
  await c.query('COMMIT');data={markerMatches:marker.length===1&&marker[0].matches,runnerIdentityMatches:identity.matches,tasks,unfinishedAttempts:attempts,queue,runners,summary,migrations};
 }finally{c.release();}}finally{await pool.end();}
 const state=await readPreviewJson(join(directory,'state.json'));const operation=await readPreviewJson(join(directory,'maintenance.json'));const processes={};
 for(const role of ['center','runner','web']){const r=state.processes[role];processes[role]={pid:r?.pid??null,group:r?.group??null,state:await inspectOwnedProcess(r),listenerMatches:role==='runner'?null:await ownsListener(r,role==='center'?config.centerPort:config.webPort)};}
 return {observedAt:new Date().toISOString(),backendSource:state.source,webArtifact:state.webArtifact??null,ports:{center:config.centerPort,web:config.webPort},operation:{id:operation.operationId,phase:operation.phase,target:operation.target},processes,...data};
}
function noNewWork(value,baseline){
 if(!value.markerMatches||!value.runnerIdentityMatches||value.runners.length!==1||!value.runners[0].configured||value.runners[0].revoked||value.runners[0].capacity!==1)fail('INSTALLATION_IDENTITY_OR_RUNNERS_CHANGED');
 if(value.unfinishedAttempts.length||value.tasks.some(x=>!['succeeded','failed','cancelled'].includes(x.status))||value.queue.some(x=>x.state==='waiting'&&x.count))fail('NEW_OR_ACTIVE_WORK');
 if(Object.values(value.processes).some(x=>x.state!=='running'||x.listenerMatches===false))fail('PROCESS_IDENTITY_UNCONFIRMED');
 if(baseline&&(JSON.stringify(value.summary)!==JSON.stringify(baseline.summary)||JSON.stringify(value.migrations)!==JSON.stringify(baseline.migrations)))fail('BUSINESS_OR_MIGRATION_CHANGED');
}
async function command(action){await source();const startedAt=new Date().toISOString();try{const r=await execute(process.execPath,[join(repository,'tools/personal-preview/cli.mjs'),'maintenance',action,'--directory',directory,...(action==='refresh'?['--target',target]:[])],{cwd:repository,env:baseServiceEnvironment('center'),timeout:120000,maxBuffer:65536});const value=JSON.parse(r.stdout);result.actions.push({action,startedAt,endedAt:new Date().toISOString(),exitCode:0,response:value});await save();return value;}catch(error){result.actions.push({action,startedAt,endedAt:new Date().toISOString(),exitCode:typeof error.code==='number'?error.code:null,error:'COMMAND_UNCONFIRMED',stdout:error.stdout?.slice(0,4096),stderr:error.stderr?.slice(0,4096)});await save();fail('COMMAND_UNCONFIRMED');}}
try{
 await source();
 const saved=JSON.parse(await readFile('/tmp/flow-svc03-window-result.json','utf8'));
 const previous=saved.actions.find(x=>x.action==='refresh');
 if(saved.error!=='READY_IDENTITY_MISMATCH'||previous?.exitCode!==0||previous.response.state!=='maintenance'||saved.actions.some(x=>x.action==='resume'))fail('RECOVERY_INPUT_UNCONFIRMED');
 await writeFile('/tmp/flow-svc03-resume-started.json',JSON.stringify({operationId:previous.response.operationId,startedAt:result.startedAt})+'\n',{flag:'wx',mode:0o600});
 const config=await loadPreviewConfiguration(directory);const configBytes=await readFile(join(directory,'config.json'));const nativeBytes=await readFile(join(directory,'claude.json'));const nativeDirectory=await stat(join(directory,'runner'));
 const unchanged=async()=>{if(!(await readFile(join(directory,'config.json'))).equals(configBytes)||!(await readFile(join(directory,'claude.json'))).equals(nativeBytes))fail('PRIVATE_CONFIGURATION_CHANGED');const n=await stat(join(directory,'runner'));if(n.ino!==nativeDirectory.ino||n.dev!==nativeDirectory.dev)fail('NATIVE_DIRECTORY_CHANGED');};
 const expected=saved.prebuild.artifact;
 const ready=await facts(config);noNewWork(ready,saved.before);await unchanged();
 if(ready.backendSource.head!==target||ready.backendSource.dirty||ready.operation.id!==previous.response.operationId||ready.operation.phase!=='ready-paused'||ready.runners[0].maintenance_state!=='maintenance'||ready.runners[0].maintenance_version!==11||!['artifactId','sourceHead','manifestDigest'].every(k=>ready.webArtifact?.[k]===expected[k]))fail('READY_IDENTITY_MISMATCH');
 await verifyWebArtifact({directory,artifact:expected});
 const status=await statusPreview({directory});if(status.webArtifact.state!=='verified'||status.webArtifact.serving!=='confirmed'||!status.center.reachable)fail('READY_HTTP_IDENTITY_UNCONFIRMED');
 result.continuation={originalOutcome:saved.outcome,originalError:saved.error,reason:'Operator-only JSON property ordering false negative; all descriptor fields independently verified equal. No product source changed or refresh retried.',originalConfigNativeUnchangedGate:'Original driver completed byte/inode unchanged checks immediately before the failed descriptor comparison.'};
 result.readyPaused={facts:ready,status,configUnchanged:true,nativeConfigUnchanged:true,nativeDirectoryIdentityUnchanged:true};await save();
 const preResume=await facts(config);noNewWork(preResume,saved.before);await unchanged();await source();if(JSON.stringify(preResume.processes)!==JSON.stringify(ready.processes)||preResume.operation.id!==ready.operation.id||preResume.runners[0].maintenance_state!=='maintenance'||preResume.runners[0].maintenance_version!==11)fail('PRE_RESUME_CHANGED');result.preResume=preResume;await save();
 const resumed=await command('resume');if(resumed.state!=='accepting'||resumed.version!==12)fail('RESUME_UNCONFIRMED');
 const final=await facts(config);noNewWork(final,saved.before);await unchanged();const finalStatus=await statusPreview({directory});if(final.runners[0].maintenance_state!=='accepting'||final.operation.id!==ready.operation.id||JSON.stringify(final.processes)!==JSON.stringify(ready.processes)||finalStatus.webArtifact.serving!=='confirmed')fail('FINAL_STATE_UNCONFIRMED');
 result.final={facts:final,status:finalStatus,configUnchanged:true,nativeConfigUnchanged:true,nativeDirectoryIdentityUnchanged:true};result.completedAt=new Date().toISOString();result.outcome='accepting';await save();console.log(JSON.stringify({outcome:result.outcome,version:resumed.version,source:target,artifactId:expected.artifactId,processes:final.processes,tasks:final.tasks,unfinishedAttempts:final.unfinishedAttempts,queue:final.queue,ports:final.ports,providerCalls:0,tabReloads:0}));
}catch(error){result.outcome='stopped-unconfirmed';result.error=/^[A-Z_]+$/.test(error.code??'')?error.code:'READ_OR_OPERATION_UNCONFIRMED';result.stoppedAt=new Date().toISOString();await save();console.error(JSON.stringify({outcome:result.outcome,error:result.error}));process.exitCode=1;}
