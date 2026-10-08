"""Finite local caller; shared OPS14 owns all child supervision."""
from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,stat,sys,time
E=Path(__file__).resolve().parent;ROOT=E.parents[2];name=sys.argv[1]
assert name in ('types','behavior','behavior-repair')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
assert now()<'2026-10-08T01:19:50.953Z'
prior=[json.loads(p.read_text()) for p in E.glob('runs/*/result.json')];assert len(prior)<3
seconds=min(20,(60000-sum(r['supervision']['elapsed_ms'] for r in prior))/1000);assert seconds>3
manager=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform')
paths=[manager/'resource-window-current.json',manager/'host-i01-newpair-queue-20261007/current.json']
raws=[p.read_bytes() for p in paths];docs=[json.loads(b) for b in raws];terms=[d['forwardAdmission']['termsBytes'] for d in docs]
assert terms[0]==terms[1];assert all(isinstance(v,int) and v>=0 for v in terms[0].values())
total=sum(terms[0].values());assert total==docs[0]['futureCompleteFreshFloorBytes']==docs[1]['floor']==docs[0]['forwardAdmission']['minimumFreshFreeBytes']==docs[1]['forwardAdmission']['minimumFreshFreeBytes']
floor=total;s=os.statvfs(ROOT);free=s.f_bavail*s.f_frsize;assert free>=floor
node='/opt/homebrew/opt/node@24/bin/node'
base=[node,str(ROOT/'node_modules/vitest/vitest.mjs'),'run','--config',str(E/'vitest.config.mjs'),'--no-cache','--reporter=verbose']
if name.startswith('types'):cmd=[node,str(ROOT/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(E/'tsconfig.json')]
elif name in ('behavior','behavior-repair'):cmd=base+[str(ROOT/'apps/server/src/plugin-runtime/verification-admission.test.ts'),str(ROOT/'packages/client/src/plugin-verification-admission.test.ts')]
else:raise AssertionError('unsupported mode')
if name=='behavior-repair':cmd+=['-t','SDK verification admission freezes|VAR admission creates|SDK admission adds identity']
out=E/'runs'/name;out.mkdir(parents=True);tmp=out/'tmp';tmp.mkdir();identity=tmp.lstat();start=time.monotonic()
def save(p,value):
 with p.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
sources=[ROOT/p for p in ['apps/server/src/plugin-runtime/verification-admission.ts', 'apps/server/src/plugin-runtime/verification-admission.test.ts', 'packages/contracts/src/plugin-verification-admission.ts', 'packages/client/src/index.ts', 'packages/client/src/plugin-management.ts', 'packages/client/src/plugin-verification-admission.test.ts']]+[Path(__file__),E/'tsconfig.json',E/'vitest.config.mjs']
hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
save(out/'reservation.json',{'at':now(),'cmd':cmd,'cwd':str(ROOT),'sourceHashes':hashes,'manager':[{'path':str(p),'sha256':hashlib.sha256(b).hexdigest(),'at':d.get('recordedAt',d.get('at'))} for p,b,d in zip(paths,raws,docs)],'terms':terms[0],'sum':total,'floor':floor,'free':free,'tmp':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino},'childLimitSeconds':seconds,'cumulativeSeconds':60,'rawCap':131072,'tmpCap':524288})
spec=importlib.util.spec_from_file_location('ops14',ROOT/'tools/owned-process-supervision/supervise.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
env={'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','LANG':'C','HOME':str(tmp),'TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','NO_COLOR':'1'}
cap=131072-sum(r['raw']['bytes'] for r in prior);assert cap>0
r=m.supervise(m.Launch(tuple(cmd),str(ROOT),env,m.Ownership.NEW_CHILD_SESSION,m.Capture.MERGED),m.Policy(seconds-5,2,3,cap))
(out/'output.log').write_bytes(r.stdout);report=dataclasses.asdict(r);report.pop('stdout');report.pop('stderr')
first=None if r.first_failure is None else r.first_failure.get('code')
closed=r.exit_code is not None and r.owned_state=='absent' and r.eof=={'stdout':True} and r.observed_bytes==r.retained_bytes==len(r.stdout) and not r.secondary_failures and first in (None,'CHILD_EXIT_NONZERO') and not any(x.get('state')=='unknown' for x in r.signals)
cur=tmp.lstat()
with os.scandir(tmp) as it:empty=next(it,None) is None
cleanup={'knownProcessClosed':closed,'removed':False,'retained':str(tmp),'sampleEmpty':empty}
if closed and empty and stat.S_ISDIR(cur.st_mode) and not stat.S_ISLNK(cur.st_mode) and (cur.st_dev,cur.st_ino)==(identity.st_dev,identity.st_ino):
 tmp.rmdir()
 try:tmp.lstat();raise RuntimeError('not absent')
 except FileNotFoundError:pass
 cleanup.update({'removed':True,'retained':None,'exactAbsenceAt':now()})
save(out/'result.json',{'at':now(),'supervision':report,'raw':{'bytes':len(r.stdout),'sha256':hashlib.sha256(r.stdout).hexdigest()},'cleanup':cleanup,'sourceHashes':hashes,'wallBeforePersistence':time.monotonic()-start})
print(json.dumps({'name':name,'exit':r.exit_code,'elapsedMs':r.elapsed_ms,'rawBytes':len(r.stdout),'cleanup':cleanup}),flush=True)
sys.exit(0 if r.exit_code==0 and closed and cleanup['removed'] else 1)
