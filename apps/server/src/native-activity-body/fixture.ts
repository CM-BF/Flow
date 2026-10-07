import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdtemp, open, readdir, rm, statfs } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as portReservation } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { taskSubmissionSchema } from '../../../../packages/contracts/src/tasks.js';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createServer } from '../index.js';
import { migrateNativeActivityBodies, registerNativeActivityBodyRoutes } from './index.js';

/** One explicitly authorized marked DB. The original P01 domain composition remains default;
 * explicit P02 production mode relies solely on the actual factory's migrations and routes. */
export async function bodyFixture(options?: { mode: 'production'; evidencePath: string }) {
  const production = options?.mode === 'production';
  const prefix = production ? 'FLOW_CHAT05P02' : 'FLOW_CHAT05P01';
  assert.equal(process.env[`${prefix}_PG_WINDOW`],'authorized', 'No explicit body PG window; no database created.');
  const allowance=Number(process.env[`${prefix}_PG_ALLOWANCE_BYTES`]);
  assert(Number.isSafeInteger(allowance)&&allowance>=96*1024**2,'Explicit PG/WAL allowance required.');
  const space=await statfs('.');assert(space.bavail*space.bsize>=1024**3+allowance,'Reserve gate before DB creation.');
  const name=`flow_chat05${production?'p02':'p01'}_${randomUUID().replaceAll('-','')}`,marker=randomUUID(),token=randomUUID();
  const evidencePath=options?.evidencePath??'docs/evidence/chat05p01/pg-run-01/fixture.jsonl';
  if(production)assert(/^docs\/evidence\/chat05p02\/pg-run-[a-zA-Z0-9-]+\/fixture\.jsonl$/.test(evidencePath),'Explicit own P02 evidence required.');
  const evidence=await open(evidencePath,'wx',0o600);
  const bounds={connectionTimeoutMillis:2000,statement_timeout:5000,query_timeout:6000};
  const admin=new Pool({...bounds,connectionString:'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres',max:1});
  const databaseUrl=`postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
  const pool=new Pool({...bounds,connectionString:databaseUrl,max:2});
  let app:Awaited<ReturnType<typeof createServer>>|undefined,base='',directory='',created=false,dropReply=false,requests=0;
  let directoryIdentity:{dev:number;ino:number}|undefined, databaseOid:number|undefined, evidenceBytes=0;
  const started=performance.now();
  const facts:Record<string,unknown>={database:name,marker,provider:0,runtimeProcesses:0,allowanceBytes:allowance,freeBeforeBytes:space.bavail*space.bsize,checkpoint:evidencePath,productionFactoryOnly:production};
  async function checkpoint(phase:string) {
    const bytes=Buffer.from(JSON.stringify({...facts,phase,at:new Date().toISOString()})+'\n');
    evidenceBytes+=bytes.length;assert(bytes.length<=65536&&evidenceBytes<=256*1024,'Evidence bound.');
    // Append-only checkpoints: a failed later write cannot erase the pre-DROP record.
    await evidence.writeFile(bytes);await evidence.sync();
  }
  async function reserve() {
    const current=await statfs('.');const free=current.bavail*current.bsize;
    facts.minObservedFreeBytes=Math.min(Number(facts.minObservedFreeBytes??free),free);
    assert(free>=1024**3,'Live reserve gate.');
  }
  async function stableDirectoryBytes(path:string):Promise<number> {
    // Used only after all body work and HTTP/pool close; never follows a link.
    let bytes=0,entries=0;const deadline=performance.now()+500;
    async function visit(folder:string):Promise<void> {
      const before=await lstat(folder);assert(before.isDirectory()&&!before.isSymbolicLink());
      for(const name of await readdir(folder)) {
        assert(++entries<=1024&&performance.now()<deadline,'Temporary observation bound.');
        const child=join(folder,name),item=await lstat(child);assert(!item.isSymbolicLink());
        if(item.isDirectory())await visit(child);else {assert(item.isFile()&&item.nlink===1);bytes+=item.size;}
      }
      const after=await lstat(folder);assert(after.isDirectory()&&before.dev===after.dev&&before.ino===after.ino);
    }
    await visit(path);return bytes;
  }
  async function start() {
    let port=0;
    if(production) {
      // One dynamic candidate; a race to bind fails normally, never stops another listener.
      const reservation=portReservation();
      await new Promise<void>((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
      try {const address=reservation.address();assert(address&&typeof address==='object');port=address.port;}
      finally {await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));}
    }
    const origin=`http://127.0.0.1:${port}`;
    app=await createServer({databaseUrl,ownerToken:token,automaticQueueScan:false,leaseMs:300_000,
      ...(production?{browserSession:{cookieOrigin:origin,trustedOrigins:[origin],authEpoch:'chat05p02-production'}}:{})});
    if(!production) {
      await migrateNativeActivityBodies(pool);
      if(!app.hasRoute({method:'GET',url:'/api/tasks/:taskId/native-activities/:activityId/body'})) registerNativeActivityBodyRoutes(app,pool);
    }
    if(production) {
      const errors:unknown[]=Array.isArray(facts.httpErrors)?facts.httpErrors:[];facts.httpErrors=errors;
      app.addHook('onError',async(request,reply,error)=>{
        // Metadata only: keep the first bounded route errors, never request bodies or credentials.
        if(errors.length<16)errors.push({request:requests,route:request.routeOptions.url??null,replyStatusBeforeErrorHandler:reply.statusCode,name:error.name,code:error.code??null});
      });
    }
    app.addHook('onRequest',async()=>{if(production)assert(++requests<=256&&performance.now()-started<90_000,'Production HTTP work bound.');await reserve();});
    app.addHook('onSend',async(request,reply)=>{
      if(dropReply&&request.url==='/api/runner/events'&&reply.statusCode===200) {dropReply=false;facts.droppedAcceptedAck=true;reply.raw.destroy();}
    });
    base=await app.listen({host:'127.0.0.1',port});facts.base=base;
  }
  async function close() {
    const errors:string[]=[];
    try {
      await app?.close();facts.appClosed=true;facts.listenerClosed=app?app.server.listening===false:true;assert(facts.listenerClosed);await pool.end();facts.poolClosed=true;
      if(created) {
        const identity=(await admin.query("SELECT oid,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",[name])).rows[0];
        assert(identity&&identity.oid===databaseOid&&identity.marker===marker,'Database identity unknown.');
        facts.databaseBytes=(await admin.query('SELECT pg_database_size($1) AS bytes',[name])).rows[0].bytes;
        assert(Number(facts.databaseBytes)<=allowance,'Database allowance exceeded; retain.');
        await reserve();
        if(directory) {facts.temporaryBytes=await stableDirectoryBytes(directory);assert(Number(facts.temporaryBytes)<=16*1024**2,'Temporary allowance exceeded; retain.');}
        const deadline=performance.now()+3000,observations:unknown[]=[];facts.connections=observations;
        for(;;) {
          const remaining=deadline-performance.now();assert(remaining>0,'Connection observation timed out.');
          const query={text:'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33',values:[name],query_timeout:Math.min(500,Math.ceil(remaining))};
          let rows:unknown[];
          try {rows=(await admin.query(query)).rows;observations.push({rows,remainingMs:Math.max(0,Math.floor(deadline-performance.now()))});}
          catch(error) {observations.push({errorType:error instanceof Error?error.name:'unknown',code:error&&typeof error==='object'&&'code'in error?String(error.code):null});throw new Error('Connection state unknown.');}
          assert(rows.length<=32&&performance.now()<=deadline,'Connection observation unconfirmed.');
          if(rows.length===0) break;await delay(Math.min(100,Math.max(0,deadline-performance.now())));
        }
        await checkpoint('before-normal-drop');await admin.query(`DROP DATABASE "${name}"`);facts.databaseDropped=true;
      } else assert(!facts.creationRequested,'CREATE outcome unknown.');
      facts.remaining=(await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[name])).rows;assert.deepEqual(facts.remaining,[]);
      if(directory) {
        const current=await lstat(directory);assert(directoryIdentity&&current.isDirectory()&&!current.isSymbolicLink()&&current.dev===directoryIdentity.dev&&current.ino===directoryIdentity.ino,'Directory identity unknown.');
        await checkpoint('before-owned-directory-remove');await rm(directory,{recursive:true});facts.directoryRemoved=true;
      }
    } catch(error) {errors.push(error instanceof Error?error.message:'unknown');}
    try {await admin.end();facts.adminClosed=true;} catch {errors.push('admin-close-unknown');}
    facts.requests=requests;facts.elapsedMs=performance.now()-started;facts.cleanupErrors=errors;
    try {await checkpoint(errors.length?'unknown-retain':'cleaned');} finally {await evidence.close();}
    assert.deepEqual(errors,[]);
  }
  try {
    await checkpoint('reserved');const parent=await open(dirname(evidencePath),'r');try{await parent.sync();}finally{await parent.close();}
    assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount,0);
    facts.creationRequested=true;await checkpoint('before-create');await admin.query(`CREATE DATABASE "${name}"`);created=true;
    await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`);facts.marked=true;
    databaseOid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[name])).rows[0]?.oid;assert(Number.isInteger(databaseOid));facts.databaseOid=databaseOid;
    directory=await mkdtemp(join(tmpdir(),production?'flow-chat05p02-pg-':'flow-chat05p01-pg-'));const info=await lstat(directory);directoryIdentity={dev:info.dev,ino:info.ino};facts.directory={path:directory,...directoryIdentity};
    await checkpoint('owned-resources');await start();
  } catch(error) {facts.startError=error instanceof Error?error.name:'unknown';try{await close();}catch{}throw error;}
  return {pool,directory,facts,close,baseUrl:()=>base,loseReply(){dropReply=true;},async restart(){await app!.close();await start();},
    owner:()=>new FlowClient({baseUrl:base,token}),runner:(credential:string)=>new FlowClient({baseUrl:base,token:credential}),
    async browserCookie() {
      assert(production,'Browser verification belongs to production composition.');
      const response=await fetch(base+'/api/browser-session/connect',{method:'POST',headers:{authorization:`Bearer ${token}`,origin:base,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
      try {assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')?.split(';')[0];assert(cookie);return cookie;}
      finally {await response.body?.cancel();}
    },
    async http<T>(path:string,credential:string=token,status=200):Promise<{value:T;bytes:number}> {
      assert((production||++requests<=160)&&performance.now()-started<90_000,'Fixture work bound.');
      const response=await fetch(base+path,{headers:{authorization:`Bearer ${credential}`},signal:AbortSignal.timeout(5000)});
      const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let bytes=0;
      try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;assert(bytes<=360448,'HTTP page bound.');chunks.push(part.value);}}finally{await reader.cancel();}
      assert.equal(response.status,status);if(status===200&&path.includes('/body'))assert.equal(response.headers.get('cache-control'),'no-store');
      return{value:JSON.parse(Buffer.concat(chunks).toString('utf8')) as T,bytes};
    },async prepareAttempt(){
      const owner=new FlowClient({baseUrl:base,token});const runner=await owner.registerRunner({name:'Synthetic body transport',harnesses:['claude'],capacity:1});
      const accepted=await owner.submit(taskSubmissionSchema.parse({title:'Synthetic body transport',prompt:'No provider.',harness:'claude'}),randomUUID());
      await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1',[accepted.task.id]);
      const transport=new FlowClient({baseUrl:base,token:runner.token});const claim=await transport.claim(AbortSignal.timeout(5000));assert.equal(claim.assignment?.task.id,accepted.task.id);
      return{taskId:accepted.task.id,token:runner.token,sessionId:randomUUID(),ownership:{attemptId:claim.assignment!.attempt.id,ownerVersion:claim.assignment!.attempt.ownerVersion}};
    }};
}
