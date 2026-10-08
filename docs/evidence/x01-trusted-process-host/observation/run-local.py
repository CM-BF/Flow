"""This feature's finite local segment; fixed OPS14 owns each process group."""
from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,sys,time,stat
E=Path(__file__).resolve().parent;ROOT=E.parents[3];VIEW=E/'view';name=sys.argv[1]
assert name in ('types','behavior','types-fix')
node='/opt/homebrew/opt/node@24/bin/node'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
if now()>'2026-10-08T02:02:54.104Z':raise RuntimeError('segment expired')
prior=[json.loads(p.read_text()) for p in E.glob('runs/*/result.json')]
assert len(prior)<3
remaining=min(20,(60000-sum(p['supervision']['elapsed_ms'] for p in prior))/1000);assert remaining>3
raw_limit=min(65536,131072-sum(p['raw']['bytes'] for p in prior));assert raw_limit>0
manager=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform')
current=json.loads((manager/'resource-window-current.json').read_text());pair=json.loads((manager/'host-i01-newpair-queue-20261007/current.json').read_text())
f=current['forwardAdmission'];q=pair['forwardAdmission'];assert f['termsBytes']==q['termsBytes']
assert all(type(v) is int and v>=0 for v in f['termsBytes'].values())
summed=sum(f['termsBytes'].values());assert summed==f['minimumFreshFreeBytes']==q['minimumFreshFreeBytes']
floor=max(13702529024,summed,current['futureCompleteFreshFloorBytes'],pair['floor'],(f.get('currentWindowConservativeFrozenFloorBytes') or 0))
free=os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize
assert free>=floor,(free,floor)
claim=json.loads((E/'fresh-claim.json').read_text());assert claim['claim']['version']==6 and claim['claim']['state']=='active'
assert claim['claim']['worker']=='db_transaction_owner' and claim['claim']['worktree']==str(ROOT)
assert (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(claim['sampledAt'].replace('Z','+00:00'))).total_seconds()<30
files=[row['path'] for row in json.loads((E/'owned-inputs.json').read_text())]
for fpath in files:assert (ROOT/fpath).read_bytes()==(VIEW/fpath).read_bytes()
cmd=([node,str(VIEW/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(E/'tsconfig.json')] if name.startswith('types') else [node,str(VIEW/'node_modules/vitest/vitest.mjs'),'run','--config',str(E/'vitest.config.mjs'),'--no-cache',str(VIEW/'apps/runner/src/plugins/process-host-observation.test.ts'),str(VIEW/'apps/runner/src/plugins/runtime.test.ts'),'-t','owned child observations|observer exceptions|cleanup unknown remains|missing protocol EOF|cancellation preserves unknown|process lifecycle notices|trusted direct runtime opt-in'])
out=E/'runs'/name;out.mkdir(parents=True);tmp=out/'tmp';tmp.mkdir();identity=tmp.lstat();whole=time.monotonic();started=now()
def save(path,value):
 with path.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
source=[Path(__file__),E/'tsconfig.json',E/'vitest.config.mjs',*(ROOT/f for f in files),*sorted(p for p in VIEW.rglob('*') if p.is_file() and 'node_modules' not in p.parts)]
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in source}
save(out/'reservation.json',{'startedAt':started,'command':cmd,'cwd':str(VIEW),'free':free,'floor':floor,'floorSource':{'recordedAt':current['recordedAt'],'termsBytes':f['termsBytes'],'sum':summed,'pairAt':pair['at']},'claim':claim,'head':(E/'fresh-head.txt').read_text().strip(),'tmp':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino},'sourceHashes':hashes,'budgets':{'childSeconds':remaining,'segmentChildren':3,'cumulativeSeconds':60,'totalBytes':8388608,'rawBytes':131072},'node':node})
spec=importlib.util.spec_from_file_location('ops14',ROOT/'tools/owned-process-supervision/supervise.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
env={'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','LANG':'C','HOME':str(tmp),'TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','NO_COLOR':'1','FORCE_COLOR':'0','FLOW_X01_PLUGIN_RUNTIME_FACTS':str(out/'fixtures.json')}
r=m.supervise(m.Launch(tuple(cmd),str(VIEW),env,m.Ownership.NEW_CHILD_SESSION,m.Capture.MERGED),m.Policy(remaining-3,1,2,raw_limit))
(out/'output.log').write_bytes(r.stdout)
report=dataclasses.asdict(r);report.pop('stdout');report.pop('stderr')
failure=None if r.first_failure is None else r.first_failure.get('code')
closed=(r.exit_code is not None and r.owned_state=='absent' and r.eof=={'stdout':True} and r.observed_bytes==r.retained_bytes==len(r.stdout) and not r.secondary_failures and failure in (None,'CHILD_EXIT_NONZERO') and not any(x.get('state')=='unknown' for x in r.signals))
cleanup={'knownProcessClosed':closed,'removed':False,'retained':str(tmp)}
current=tmp.lstat()
with os.scandir(tmp) as entries:empty=next(entries,None) is None
if closed and stat.S_ISDIR(current.st_mode) and not stat.S_ISLNK(current.st_mode) and (current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino) and empty:
 tmp.rmdir()
 try:tmp.lstat();raise RuntimeError('TMP still exists')
 except FileNotFoundError:pass
 cleanup.update({'removed':True,'retained':None,'sampleBytes':0,'exactAbsenceAt':now()})
record={'startedAt':started,'finishedAt':now(),'wallBeforePersistenceSeconds':time.monotonic()-whole,'supervision':report,'cleanup':cleanup,'raw':{'bytes':len(r.stdout),'sha256':hashlib.sha256(r.stdout).hexdigest()},'sourceHashes':hashes}
save(out/'result.json',record)
print(json.dumps({'name':name,'exit':r.exit_code,'elapsedMs':r.elapsed_ms,'raw':record['raw'],'cleanup':cleanup,'owned':r.owned_state,'eof':r.eof}),flush=True)
sys.exit(0 if r.exit_code==0 and closed and cleanup['removed'] else 1)
