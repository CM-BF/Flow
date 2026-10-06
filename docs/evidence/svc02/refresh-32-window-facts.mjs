import { readFile, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { loadPreviewConfiguration, readPreviewJson, statusPreview } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/preview.mjs';
import { inspectOwnedProcess, ownsListener } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/process.mjs';
const require=createRequire('/Users/citrine/Projects/AgentHarness/Flow/apps/server/package.json');const {Pool}=require('pg');
const execute=promisify(execFile);const directory='/Users/citrine/.flow-personal';const sampleLabel=process.argv[2];if(!/^[a-z0-9-]{1,64}$/.test(sampleLabel??''))throw new Error('SAMPLE_LABEL_REQUIRED');let phase='private-identity';let pool;
const report={observedAt:new Date().toISOString(),operation:'read-only preparation; no maintenance writes, POST, migration, stop, start, reload or provider query',target:'32c371d389a913f8dd71c3bd8b98dd0697411256'};
try {
 const config=await loadPreviewConfiguration(directory), state=await readPreviewJson(directory+'/state.json');
 const privateFacts={};const privateHashes={};
 for(const name of ['config.json','claude.json','state.json','maintenance.json']){const st=await lstat(directory+'/'+name);privateFacts[name]={mode:(st.mode&0o777).toString(8),ownerMatches:st.uid===process.getuid(),regular:st.isFile(),symlink:st.isSymbolicLink(),bytes:st.size};privateHashes[name]=createHash('sha256').update(await readFile(directory+'/'+name)).digest('hex');}
 const native=await readPreviewJson(directory+'/claude.json');const expected={model:'claude-sonnet-5-5',materialFiles:[],allowRead:false,requireReadApproval:false,maxTurns:2,maxBudgetUsd:0.2,timeoutMs:60000};
 const nativeDir=await lstat(directory+'/runner');
 report.private={directoryMode:((await lstat(directory)).mode&0o777).toString(8),files:privateFacts,nativeConfigurationMatches:JSON.stringify(native)===JSON.stringify(expected),nativeDirectory:{mode:(nativeDir.mode&0o777).toString(8),device:nativeDir.dev,inode:nativeDir.ino},operationLockPresent:await lstat(directory+'/operation.lock').then(()=>true,e=>e.code==='ENOENT'?false:Promise.reject(e))};
 await writeFile('/tmp/flow-svc02-private-baseline-'+sampleLabel+'.json',JSON.stringify({observedAt:report.observedAt,hashes:privateHashes,nativeDirectory:{dev:nativeDir.dev,ino:nativeDir.ino}}),{mode:0o600,flag:'wx'});
 phase='process-identity';report.status=await statusPreview({directory});delete report.status.credentialsFile;
 report.sourceNow={head:(await execute('git',['-C',config.repository,'rev-parse','HEAD'])).stdout.trim(),dirty:Boolean((await execute('git',['-C',config.repository,'status','--porcelain'])).stdout.trim()),repositoryMatchesMain:config.repository==='/Users/citrine/Projects/AgentHarness/Flow'};
 const ps=(await execute('ps',['-ax','-o','pid=','-o','ppid=','-o','pgid=','-o','command='],{timeout:2000})).stdout.split('\n').map(s=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(s);return m?{pid:+m[1],ppid:+m[2],pgid:+m[3],command:m[4]}:null}).filter(Boolean);
 async function cwd(pid){try{return(await execute('lsof',['-a','-p',String(pid),'-d','cwd','-Fn'],{timeout:1500})).stdout.split('\n').find(s=>s.startsWith('n'))?.slice(1)??'unknown';}catch{return'unknown';}}
 report.processes={};for(const role of ['center','runner','web']){const record=state.processes[role];report.processes[role]={identity:await inspectOwnedProcess(record),pid:record.pid,pgid:record.group,cwd:await cwd(record.pid),startedAt:record.startedAt,members:await Promise.all(ps.filter(p=>p.pgid===record.group).map(async p=>({pid:p.pid,ppid:p.ppid,pgid:p.pgid,cwd:await cwd(p.pid),role:p.pid===record.pid?'owned-wrapper':p.command.includes('apps/server/src/main.ts')?'center-main':p.command.includes('apps/runner/src/main.ts')?'runner-main':p.command.includes('vite')?'vite':'other-member'})))};}
 report.listeners={center:await ownsListener(state.processes.center,config.centerPort),web:await ownsListener(state.processes.web,config.webPort)};
 report.localRunnerEntrypoints=await Promise.all(ps.filter(p=>p.command.includes('apps/runner/src/main.ts')&&!p.command.includes('ps -ax')).map(async p=>({pid:p.pid,ppid:p.ppid,pgid:p.pgid,cwd:await cwd(p.pid),ownedGroup:p.pgid===state.processes.runner.group})));
 phase='read-only-database';pool=new Pool({connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:1500,statement_timeout:3000,application_name:'flow-svc02-readonly-preparation'});
 const client=await pool.connect();try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const rows=async(q,v)=>(await client.query(q,v)).rows;
  const marker=await rows('SELECT installation_id,directory FROM public.flow_preview_owner');
  const digest=createHash('sha256').update(config.runner.token).digest('hex');
  const matches=await rows('SELECT id FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked',[config.runner.runnerId,digest]);
  report.database={snapshotAt:(await rows('SELECT clock_timestamp() AS at'))[0].at,markerMatches:marker.length===1&&marker[0].installation_id===config.installationId&&marker[0].directory===config.directory,runnerIdentityMatches:matches.length===1,managedRunnerId:config.runner.runnerId};
  report.database.taskCounts=await rows('SELECT status,count(*)::int AS count FROM flow.tasks GROUP BY status ORDER BY status');
  report.database.unfinishedAttempts=await rows('SELECT a.id AS attempt_id,a.task_id,a.runner_id,a.owner_version,t.status,a.last_heartbeat_at,a.lease_expires_at FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id WHERE a.completed_at IS NULL ORDER BY a.id LIMIT 101');
  report.database.unfinishedAttemptCount=(await rows('SELECT count(*)::int AS n FROM flow.attempts WHERE completed_at IS NULL'))[0].n;
  report.database.registeredRunners=await rows(`SELECT r.id AS runner_id,r.harnesses,r.capacity,r.revoked,r.maintenance_state,r.maintenance_version,r.maintenance_operation_id,count(a.id) FILTER(WHERE a.completed_at IS NULL)::int AS unfinished_attempts,max(a.last_heartbeat_at) AS last_heartbeat_at FROM flow.runners r LEFT JOIN flow.attempts a ON a.runner_id=r.id GROUP BY r.id ORDER BY r.id`);
  report.database.profiles=await rows("SELECT id,runner_id,config_digest,configuration->>'access' AS access,configuration->>'model' AS model,configuration->'activeSteering' AS active_steering FROM flow.execution_profiles ORDER BY id");
  report.database.migrationRecords=await rows('SELECT * FROM flow.migrations ORDER BY version');
  report.database.migrations=report.database.migrationRecords.map(r=>r.version);
  report.database.tableInventory=(await rows("SELECT table_name FROM information_schema.tables WHERE table_schema='flow' AND table_type='BASE TABLE' ORDER BY table_name")).map(r=>r.table_name);
  report.database.retainedCounts={};for(const table of ['tasks','attempts','sessions','artifacts','details','conversations','conversation_turns','conversation_queue']){if((await rows('SELECT to_regclass($1) AS name',['flow.'+table]))[0].name)report.database.retainedCounts[table]=(await rows(`SELECT count(*)::int AS count FROM flow.${table}`))[0].count;}
  report.database.retainedRecords={};
  for(const table of ['tasks','attempts','sessions','artifacts','details','conversations','conversation_turns','conversation_queue','execution_profiles']){
   if(!(await rows('SELECT to_regclass($1) AS name',['flow.'+table]))[0].name)continue;
   const omitted=table==='conversations'?['queue_checked_at']:[];
   const records=await rows(`SELECT jsonb_strip_nulls(jsonb_build_object('id',j->'id','taskId',j->'task_id','artifactId',j->'artifact_id','version',j->'version','conversationId',j->'conversation_id','sequence',j->'sequence')) AS identity,md5((j-$1::text[])::text) AS row_digest FROM (SELECT to_jsonb(t) AS j FROM flow.${table} t) source ORDER BY row_digest LIMIT 2001`,[omitted]);
   report.database.retainedRecords[table]={digestPurpose:'change detection, not cryptographic authenticity',omittedMutableFields:omitted,complete:records.length<=2000,records:records.slice(0,2000)};
  }
  if((await rows("SELECT to_regclass('flow.conversation_queue') AS name"))[0].name)report.database.conversationQueue=await rows('SELECT state,count(*)::int AS count FROM flow.conversation_queue GROUP BY state ORDER BY state');else report.database.conversationQueue={schemaInstalled:false};
  if(process.argv[3]==='preservation'){
   report.database.allOldTables={};
   for(const table of report.database.tableInventory){
    if(!/^[a-z_]+$/.test(table))throw new Error('Unexpected table identifier');
    const excluded=table==='conversations'?['queue_checked_at']:table==='runners'?['maintenance_state','maintenance_version','maintenance_operation_id']:[];
    const columns=(await rows('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['flow',table])).map(r=>r.column_name);
    const records=await rows(`SELECT md5((to_jsonb(t)-$1::text[])::text) AS row_digest FROM flow.${table} t ORDER BY row_digest LIMIT 2001`,[excluded]);
    report.database.allOldTables[table]={columns,excluded,complete:records.length<=2000,records};
   }
  }
  report.database.connections=await rows(`SELECT coalesce(application_name,'') AS application_name,state,count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY application_name,state ORDER BY application_name,state`);
  await client.query('COMMIT');
 }finally{client.release();}
 report.localMaintenance=await readPreviewJson(directory+'/maintenance.json');report.localMaintenance={phase:report.localMaintenance.phase,target:report.localMaintenance.target,operationId:report.localMaintenance.operationId};
 report.limitations=['One instant snapshot is not a lock, drain, hold, or permission to stop.','Process inventory identifies recognized entrypoints; it cannot exclude another host or custom same-credential deployment.','All other active/unknown deployments require operator coordination before any center stop.','SDK/provider availability and real model calls were not probed.','SourceAtStart records startup; Vite files may follow checkout changes without a controlled bundle refresh.'];
 report.outcome='observed';
}catch(error){report.outcome='unknown';report.failurePhase=phase;report.errorCode=typeof error.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'READ_UNCONFIRMED';process.exitCode=1;}finally{await pool?.end();}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
