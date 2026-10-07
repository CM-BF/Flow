"""One bounded X01 upstream range upgrade local segment; shared OPS14 owns the child lifecycle."""
from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,sys,time
ROOT=Path(__file__).resolve().parents[3]
E=ROOT/'docs/evidence/x01-upstream-upgrade'
name=sys.argv[1];assert name in ('build','types','types-fix','test','test-fix')
node='/opt/homebrew/opt/node@24/bin/node'
files=['apps/runner/src/plugins/semver-upstream-upgrade.test.ts']
cmd=([node,str(E/'build.mjs')] if name=='build' else [node,str(ROOT/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(E/'tsconfig.json')] if name.startswith('types') else [node,str(ROOT/'node_modules/vitest/vitest.mjs'),'run','--config',str(E/'vitest.config.mjs'),'--configLoader','native',*files])
free=os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize
# Preserve the existing conservative combination floor; refresh active declarations before each actual run.
floor=6300000000
if free<floor: print(json.dumps({'state':'HOLD','free':free,'required':floor}));sys.exit(3)
if time.time() > 1791374319: raise RuntimeError('Segment deadline 11:58:39Z')
out=E/name;out.mkdir();tmp=out/'tmp';tmp.mkdir();identity=tmp.stat();started=datetime.datetime.now(datetime.timezone.utc).isoformat();whole=time.monotonic()
def save(path,value):
 with path.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
prior=[json.loads(p.read_text()) for p in E.glob('*/result.json')]
if sum(p['supervision']['elapsed_ms'] for p in prior)>=120000:raise RuntimeError('Cumulative child budget exhausted')
save(out/'reservation.json',{'startedAt':started,'command':cmd,'cwd':str(ROOT),'free':free,'required':floor,'tmp':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino},'budgets':{'childSeconds':60,'cumulativeSeconds':120,'tmpBytes':16777216,'rawBytes':524288},'tmpMeasurement':'before/after sample; not realtime OS isolation'})
spec=importlib.util.spec_from_file_location('readbound_supervision',ROOT/'tools/owned-process-supervision/supervise.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
env=os.environ.copy()
for key in list(env):
 if key.startswith('FLOW_') or key in ('NODE_COMPILE_CACHE',):env.pop(key)
env.update({'FLOW_UPSTREAM_FACTS':str(out/'host-facts.json'),'FLOW_X01_BINDING_CACHE':str(tmp/'cache'),'TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','NO_COLOR':'1','FORCE_COLOR':'0'})
remaining=min(60,(120000-sum(p['supervision']['elapsed_ms'] for p in prior))/1000)
r=m.supervise(m.Launch(tuple(cmd),str(ROOT),env,m.Ownership.NEW_CHILD_SESSION,m.Capture.MERGED),m.Policy(max(0,remaining-3),1,2,min(131072,524288-sum(p['raw']['bytes'] for p in prior))))
raw=r.stdout
with (out/'output.log').open('xb') as f:f.write(raw)
report=dataclasses.asdict(r);report.pop('stdout');report.pop('stderr')
def process_closed(r):
 failure = None if r.first_failure is None else r.first_failure.get('code')
 return (r.exit_code is not None and r.owned_state == 'absent'
         and r.eof == {'stdout': True} and r.observed_bytes == r.retained_bytes == len(r.stdout)
         and not r.secondary_failures and failure in (None, 'CHILD_EXIT_NONZERO')
         and not any(item.get('state') == 'unknown' for item in r.signals))
closed=process_closed(r)
cleanup={'knownProcessClosed':closed,'tmpRemoved':False,'retained':str(tmp)}
if closed:
 helper=ROOT/'docs/evidence/x01/enable-binding-pg-once.py'
 spec2=importlib.util.spec_from_file_location('version_resources',helper);resources=importlib.util.module_from_spec(spec2);sys.modules[spec2.name]=resources;spec2.loader.exec_module(resources)
 rows,size=resources.tree_sample(tmp,(identity.st_dev,identity.st_ino),time.monotonic()+5,{'temporaryEntries':4096,'temporaryBytes':16777216})
 resources.remove_sample(rows,time.monotonic()+5)
 assert not tmp.exists();cleanup.update({'tmpRemoved':True,'retained':None,'sampleBytes':size,'sampleEntries':len(rows)})
record={'startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wallBeforePersistenceSeconds':time.monotonic()-whole,'supervision':report,'cleanup':cleanup,'raw':{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'sourceHashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),E/'tsconfig.json',E/'vitest.config.mjs',*(ROOT/f for f in files)] if p.exists()}}
save(out/'result.json',record)
print(json.dumps(record))
sys.exit(0 if r.exit_code==0 and closed and cleanup['tmpRemoved'] else 1)
