import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bounded, durable } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { maintainPreview } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/maintenance-host.mjs';
const base=dirname(fileURLToPath(import.meta.url)), plan=JSON.parse(await readFile(join(base,'../maintenance-continuation.json'),'utf8'));
const op='e6550b3c-1f67-4c2c-869d-e84d5e838113', sha=b=>createHash('sha256').update(b).digest('hex');
const report={startedAt:new Date().toISOString(),outcome:'unknown',scope:'One exact admission file, two original read-only public status calls; no journal mutation or tasks'};
const safe=s=>({runnerId:s.runnerId,version:s.version,state:s.state,operationId:s.operationId,activeAttempts:s.activeAttempts,uncertainAttempts:s.uncertainAttempts,stopPermitted:s.stopPermitted});
const verify=s=>{ assert.equal(s.runnerId,plan.runnerId);assert.equal(s.version,19);assert.equal(s.state,'draining');assert.equal(s.operationId,op);assert.equal(s.activeAttempts,0);assert.equal(s.uncertainAttempts,0); };
const identity=s=>({dev:String(s.dev),ino:String(s.ino),uid:s.uid,mode:s.mode&0o777,nlink:s.nlink,bytes:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs});
const namespace=join(plan.runnerIdle.root,plan.runnerIdle.namespace), path=join(namespace,'admission.json');
try {
 report.before=safe(await maintainPreview({directory:plan.directory,action:'status'}));verify(report.before);
 const ns=await lstat(namespace);assert.ok(ns.isDirectory()&&!ns.isSymbolicLink());assert.equal(await realpath(namespace),namespace);assert.deepEqual({dev:ns.dev,ino:ns.ino,uid:ns.uid},plan.runnerIdle.namespaceIdentity);
 const before=await lstat(path);assert.ok(before.isFile()&&!before.isSymbolicLink());assert.equal(before.uid,process.getuid());assert.equal(before.nlink,1);assert.equal(before.mode&0o777,0o600);
 const {bytes,stat}=await bounded(path,65536);assert.deepEqual(identity(stat),identity(before));assert.deepEqual(identity(await lstat(path)),identity(before));
 const value=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));assert.ok(value&&typeof value==='object'&&!Array.isArray(value));
 const keys=Object.keys(value).sort();assert.ok(keys.length<=32&&keys.every(k=>k.length<=128));
 const uuid=typeof value.inFlight==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.inFlight);
 report.admission={path,identity:identity(before),bytes:bytes.length,sha256:sha(bytes),keys,version:Number.isSafeInteger(value.version)?value.version:'not-an-integer',assignmentsIsArray:Array.isArray(value.assignments),assignmentsLength:Array.isArray(value.assignments)?value.assignments.length:null,inFlight:{isNull:value.inFlight===null,isUuid:uuid,type:typeof value.inFlight,...(uuid?{sha256:sha(value.inFlight)}:{})},strictIdle:keys.join(',')==='assignments,inFlight,version'&&value.version===1&&value.inFlight===null&&Array.isArray(value.assignments)&&value.assignments.length===0};
 report.after=safe(await maintainPreview({directory:plan.directory,action:'status'}));verify(report.after);assert.deepEqual(report.after,report.before);
 report.outcome='same-operation-readonly-observed';
} catch(error) {report.failure={name:error.name,code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'READONLY_UNCONFIRMED'};process.exitCode=1;}
report.endedAt=new Date().toISOString();await durable(join(base,'observation.json'),report);
console.log(JSON.stringify({outcome:report.outcome,admission:report.admission?{bytes:report.admission.bytes,keys:report.admission.keys,version:report.admission.version,assignmentsLength:report.admission.assignmentsLength,inFlight:report.admission.inFlight,strictIdle:report.admission.strictIdle}:null,before:report.before,after:report.after,failure:report.failure}));
