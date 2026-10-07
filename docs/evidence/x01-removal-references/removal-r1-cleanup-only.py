"""One explicitly authorized cleanup of R1 identities; no test, retry, force, or foreign-resource signal."""
import datetime,errno,hashlib,importlib.util,json,os,socket,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[3]; E=ROOT/'docs/evidence/x01-removal-references'
def load(name,p,sha):
 assert hashlib.sha256(p.read_bytes()).hexdigest()==sha
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
ops=load('cleanup_ops',Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py'),'725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d')
res=load('cleanup_resources',E/'enable-binding-pg-once.py','86a98a35bfc7fb3a0c3cd01645fa6d48dd3873812b22be7c2236999626417a56')
facts=load('cleanup_facts',E/'enable-binding-check-once.py','cfe2b708c762752926f1f24899120fd802ea97e80bc115fabcea12c0b3a3847a')
started=time.monotonic();deadline=started+60;now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
record={'startedAt':now(),'state':'KEEP','limits':{'seconds':60,'entries':4096,'temporaryBytes':33554432,'rawBytes':16384},'originalResult':'UNKNOWN_KEEP unchanged','groups':[]}
assert not (E/'removal-r1-cleanup-only.json').exists()
try:
 free=os.statvfs(ROOT);record.update(freeBytes=free.f_bavail*free.f_frsize,floorBytes=6199705600);assert record['freeBytes']>=record['floorBytes']
 for pid in (27816,27842):
  try:os.killpg(pid,0);state='present'
  except ProcessLookupError:state='absent'
  except OSError:state='unknown'
  record['groups'].append({'pgid':pid,'state':state});assert state=='absent'
 try:
  s=socket.create_connection(('127.0.0.1',64030),timeout=1);s.close();raise ValueError('Original listener endpoint is occupied')
 except ConnectionRefusedError:record['listener']={'port':64030,'state':'connection-refused'}
 original=json.loads(res.read_regular(E/'removal-references-pg-run-r1/runtime-result.json',16384));assert original['cleanup']['ownersClosed'] and original['cleanup']['poolClosed'] and original['cleanup']['adminClosed'] and all(x['closed'] for x in original['listeners'])
 code=r'''import {Pool} from 'pg';
 const db='flow_x01_8c07aa72e0814fab904e7505cc7d9c59';
 const expected={oid:'1306114',owner:'flow',marker:'x01:a90e0b892a444422abd7e842867b8858:runtime:73119866-10a8-4a65-9fd9-f75a579a2df3'};
 const pool=new Pool({connectionString:'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres',max:1,connectionTimeoutMillis:1500,statement_timeout:5000,query_timeout:6000});
 const out={startedAt:new Date().toISOString(),database:db,expected,state:'KEEP',adminClosed:false,dropRequested:false,dropAcknowledged:false};
 const identity=async()=> (await pool.query("SELECT oid::text AS oid,pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",[db])).rows[0];
 try{out.observed=await identity();if(!out.observed||Object.keys(expected).some(k=>out.observed[k]!==expected[k]))throw Error('identity mismatch');
 out.connections=(await pool.query('SELECT pid,usename AS role,application_name AS app,state,backend_start AS "backendStart" FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 129',[db])).rows;
 if(out.connections.length!==0)throw Error('retained connections');
 const second=await identity();if(!second||Object.keys(expected).some(k=>second[k]!==expected[k]))throw Error('identity changed before drop');
 out.dropRequested=true;await pool.query('DROP DATABASE '+db);out.dropAcknowledged=true;out.absent=(await identity())===undefined;if(!out.absent)throw Error('absence not confirmed');out.state='CLOSED';
 }catch(error){out.failure=error.message;}finally{try{await pool.end();out.adminClosed=true;}catch{out.failure='admin close unknown';out.state='KEEP';}}
 out.finishedAt=new Date().toISOString();console.log(JSON.stringify(out));if(out.state!=='CLOSED'||!out.adminClosed)process.exitCode=1;'''
 env=dict(os.environ);env['NODE_DISABLE_COMPILE_CACHE']='1'
 child=ops.supervise(ops.Launch(('/opt/homebrew/opt/node@24/bin/node','--input-type=module','-e',code),str(ROOT),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(15,.5,1,16384))
 process,unknown=facts.supervision_facts(child,'cleanup-admin');record['process']=process;record['raw']=(child.stdout+child.stderr).decode();record['rawSha256']=hashlib.sha256(child.stdout+child.stderr).hexdigest();assert not unknown and child.exit_code==0
 db=json.loads(record['raw']);record['database']=db;assert db['state']=='CLOSED' and db['adminClosed'] and db['absent']
 root=Path('/private/var/folders/f1/2xjyyqkn5plc19fx4nt4tpt00000gn/T/flow-x01-pg-txfsxrqu');identity=(16777234,124112945)
 rows,size=res.tree_sample(root,identity,deadline-3,{'temporaryEntries':4096,'temporaryBytes':33554432});record['temporary']={'path':str(root),'dev':identity[0],'ino':identity[1],'entries':len(rows),'sampleBytes':size,'peakProven':False,'removed':False}
 original_files={'vitest.json':E/'removal-r1-vitest-retained-copy.json'}
 for name in ('reservation','create-request','created','result'):original_files['fixtures/runtime/'+name+'.json']=E/('removal-references-pg-run-r1/runtime-'+name+'.json')
 for name,copy in original_files.items():assert res.read_regular(root/name,131072)==res.read_regular(copy,131072),'raw changed'
 record['rawCopiesVerified']=list(original_files)
 res.remove_sample(rows,deadline-3)
 try:root.lstat();raise ValueError('temporary persists')
 except FileNotFoundError:record['temporary']['removed']=True;record['temporary']['absent']=True
 record['state']='RETURN'
except BaseException as error:record['failureType']=type(error).__name__
record['endedBeforePersistenceAt']=now();record['elapsedBeforePersistenceSeconds']=time.monotonic()-started
if time.monotonic()+2>=deadline:record['state']='KEEP';record['deadlineUnknown']=True
res.save(E/'removal-r1-cleanup-only.json',record)
print(json.dumps({'state':record['state'],'start':record['startedAt'],'end':now(),'elapsedAfterPersistenceSeconds':time.monotonic()-started,'temporary':record.get('temporary'),'database':record.get('database')}))
raise SystemExit(0 if record['state']=='RETURN' and time.monotonic()<deadline else 1)
