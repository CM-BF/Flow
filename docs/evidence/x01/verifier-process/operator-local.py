"""Two pure operator boundary checks; lifecycle authority remains fixed OPS14."""
import datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile, time
from pathlib import Path
sys.dont_write_bytecode = True
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[3]; RECORD=HERE/'operator-local.json'
def load(name,path,sha):
 data=path.read_bytes()
 if hashlib.sha256(data).hexdigest()!=sha: raise ValueError('fixed helper changed')
 spec=importlib.util.spec_from_file_location(name,path); module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module);return module
ops=load('verifier_ops',Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py'),'725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d')
# The local converter has no launch side effect; canonical root guard handles only this new owned TMP.
facts=load('verifier_facts',ROOT/'docs/evidence/x01/enable-binding-check-once.py','cfe2b708c762752926f1f24899120fd802ea97e80bc115fabcea12c0b3a3847a')
resources=load('verifier_cleanup',ROOT/'docs/evidence/x01/enable-binding-pg-once.py','64add9586fbf99458187f1569be3dc8ff17f3ad4d30be1d74a4a9568653ffcf5')
stamp=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
record=json.loads(RECORD.read_text()) if RECORD.exists() else {'attempts':[],'unknown':False,'PG':0,'worker':0,'listener':0,'wholeExternalWall':None}
label=sys.argv[1]
if label not in ('selection','archive') or record['unknown'] or len(record['attempts'])>=3 or sum(x['supervisorMs'] for x in record['attempts'])>=20000:raise ValueError('iteration bound')
ending=datetime.datetime.fromisoformat(json.loads((HERE/'operator-start.json').read_text())['deadline'].replace('Z','+00:00')).timestamp()
if time.time()+25>=ending:raise ValueError('segment closing')
canonical=json.loads(Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json').read_text());forward=canonical['forwardAdmission'];terms=forward['termsBytes'];floor=sum(terms.values())
if terms.get('MikaX01ThinOperatorPreparation')!=4194304:raise ValueError('own term absent')
if floor!=forward['minimumFreshFreeBytes']:raise ValueError('full sum mismatch')
frozen=forward.get('currentWindowConservativeFrozenFloorBytes')
if type(frozen) is not int or frozen<=0:raise ValueError('frozen selection unknown')
floor=max(floor,frozen)
free=shutil.disk_usage(ROOT).free
if free<floor:raise ValueError('free below full floor')
ledger=json.load(sys.stdin);claim=next(c for c in ledger['claims'] if c['claimId']=='6ddedc73-f019-4073-b421-d23d3dc8dedd')
if claim['version']!=34 or claim['state']!='active' or claim['worker']!='architecture_read' or claim['worktree']!=str(ROOT) or claim['branch']!='codex/plugin-enable-binding' or 'docs/evidence/x01' not in claim['scope']:raise ValueError('claim changed')
if any(claim['claimId'] in str(x) for x in ledger.get('conflicts',[])):raise ValueError('claim conflict')
root=Path(tempfile.mkdtemp(prefix='flow-x01-verifier-local-')).resolve();identity=root.lstat();(root/'tmp').mkdir();(root/'cache').mkdir()
step={'label':label,'startedAt':stamp(),'floor':floor,'terms':terms,'free':free,'canonicalAt':forward.get('at'),'frozenFloor':frozen,'claim':claim,'temporary':{'path':str(root),'dev':identity.st_dev,'ino':identity.st_ino},'sourceHashes':{}}
for p in [HERE/'pg-once.py',HERE/'operator-pure.test.py',HERE/'pg-operator-input.json',Path(__file__)]:step['sourceHashes'][str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
record['lateAuthorization']={'maxChildren':3,'scope':'last archive+distinct-worker-negative-and-positive only','source':'root02:19 D01 cancelled-before-open drain; original deadline/cum40/cap4MiB unchanged'}
if len(record['attempts'])==2 and label!='archive':raise ValueError('third is archive only')
record['attempts'].append(step);RECORD.write_text(json.dumps(record,indent=2)+'\n')
argv=[sys.executable,'-I','-B',str(HERE/'operator-pure.test.py'),label]
env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TZ':'UTC','TMPDIR':str(root/'tmp'),'TMP':str(root/'tmp'),'TEMP':str(root/'tmp'),'FLOW_X01_BINDING_CACHE':str(root/'cache'),'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1'}
started=time.monotonic()
try:
 result=ops.supervise(ops.Launch(tuple(argv),str(ROOT),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(15,1,4,65536-sum(x.get('rawBytes',0) for x in record['attempts'])))
 process,unknown=facts.supervision_facts(result,label);record['unknown']|=unknown
 raw=result.stdout+result.stderr;step.update(argv=argv,process=process,raw=raw.decode('utf8'),rawBytes=len(raw),rawSha256=hashlib.sha256(raw).hexdigest(),supervisorMs=result.elapsed_ms)
 if not unknown:
  rows,size=resources.tree_sample(root,(identity.st_dev,identity.st_ino),started+20,{'temporaryEntries':1024,'temporaryBytes':131072});step['temporary']['sample']={'entries':len(rows),'bytes':size,'peak':None}
  resources.remove_sample(rows,started+20)
  try:root.lstat();raise ValueError('TMP remains')
  except FileNotFoundError:step['temporary'].update(removed=True,absent=True)
except Exception as error:
 record['unknown']=True;step['errorType']=type(error).__name__
finally:
 step['finishedAt']=stamp();step['elapsedBeforePersistence']=time.monotonic()-started;RECORD.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'label':label,'exit':step.get('process',{}).get('exit_code'),'unknown':record['unknown'],'raw':step.get('raw'),'temporary':step['temporary']}))
if record['unknown'] or step.get('process',{}).get('exit_code')!=0:raise SystemExit(1)
