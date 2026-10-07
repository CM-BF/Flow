"""This feature's finite local segment; fixed OPS14 owns each process group."""
from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,sys,time,stat
E=Path(__file__).resolve().parent;ROOT=E.parents[3];VIEW=E/'view';name=sys.argv[1]
assert name in ('behavior','types','behavior-fix','types-fix','direct','types-final')
node='/opt/homebrew/opt/node@24/bin/node'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
if now()>'2026-10-07T19:46:26.000Z':raise RuntimeError('segment expired')
prior=[json.loads(p.read_text()) for p in E.glob('runs/*/result.json')]
assert len(prior)<6
remaining=min(40,(150000-sum(p['supervision']['elapsed_ms'] for p in prior))/1000);assert remaining>3
raw_limit=min(350000,2097152-sum(p['raw']['bytes'] for p in prior));assert raw_limit>0
floor=18499239936;free=os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize
if free<floor:print(json.dumps({'state':'HOLD','free':free,'floor':floor}));sys.exit(3)
files=['process-host.ts','process-worker.ts','process-protocol.ts','process-resources.ts','process-host.test.ts']
for f in files:assert (ROOT/'apps/runner/src/plugins'/f).read_bytes()==(VIEW/'apps/runner/src/plugins'/f).read_bytes()
cmd=([node,str(ROOT/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(E/'tsconfig.json')] if name.startswith('types') else [node,str(ROOT/'node_modules/vitest/vitest.mjs'),'run','--config',str(E/'vitest.config.mjs'),'--no-cache',str(VIEW/'apps/runner/src/plugins/process-host.test.ts')])
if name=='behavior-fix':cmd+=['-t','trusted verifier scratch failure']
if name=='direct':cmd+=['-t','trusted verifier worker preserves typed result']
out=E/'runs'/name;out.mkdir(parents=True);tmp=out/'tmp';tmp.mkdir();identity=tmp.lstat();whole=time.monotonic();started=now()
def save(path,value):
 with path.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
source=[Path(__file__),E/'tsconfig.json',E/'vitest.config.mjs',*(ROOT/'apps/runner/src/plugins'/f for f in files),*sorted(p for p in VIEW.rglob('*') if p.is_file() and 'node_modules' not in p.parts)]
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in source}
save(out/'reservation.json',{'startedAt':started,'command':cmd,'cwd':str(ROOT),'free':free,'floor':floor,'floorSource':'manager canonical19:28:11.839 plus Q01 new8MiB; own16MiB already included','tmp':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino},'sourceHashes':hashes,'budgets':{'childSeconds':remaining,'segmentChildren':6,'cumulativeSeconds':150,'totalBytes':16777216,'rawBytes':2097152},'node':node})
spec=importlib.util.spec_from_file_location('ops14',ROOT/'tools/owned-process-supervision/supervise.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
env={'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','LANG':'C','HOME':str(tmp),'TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','NO_COLOR':'1','FORCE_COLOR':'0','FLOW_PROCESS_VERIFIER_REPORT':str(out/'fixtures.json')}
r=m.supervise(m.Launch(tuple(cmd),str(ROOT),env,m.Ownership.NEW_CHILD_SESSION,m.Capture.MERGED),m.Policy(remaining-3,1,2,raw_limit))
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
