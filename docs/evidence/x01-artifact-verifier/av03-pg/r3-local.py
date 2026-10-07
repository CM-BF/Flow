"""One affected strict check; existing OPS14 owns supervision. No PG import or service."""
from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,sys,time
R=Path(__file__).resolve().parents[4];H=R/'docs/evidence/x01-artifact-verifier/av03-pg'
C=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
OPS=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(OPS.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
stamp=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
now=datetime.datetime.now(datetime.timezone.utc);assert now<datetime.datetime.fromisoformat('2026-10-07T22:23:17+00:00')
c=json.loads(C.read_text());f=c['forwardAdmission'];floor=sum(f['termsBytes'].values());assert floor==f['minimumFreshFreeBytes'] and f['termsBytes']['MikaStableOrdinaryEnvelope']==16777216
assert not c.get('selectedWindows') and not c.get('activeWindows')
free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert free>=floor
out=H/'r3-local-strict';out.mkdir();tmp=out/'tmp';tmp.mkdir();identity=tmp.lstat()
cmd=('/opt/homebrew/opt/node@24/bin/node',str(R/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(H/'tsconfig.json'))
start=stamp();t=time.monotonic()
reservation={'at':start,'canonicalAt':c['recordedAt'],'termsBytes':f['termsBytes'],'floor':floor,'free':free,'command':cmd,'TMP':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino},'maxSeconds':30,'wholeSegmentSeconds':45,'rawCap':131072,'totalNewLogicalCap':2097152,'noDoubleReserve':True}
(out/'reservation.json').write_text(json.dumps(reservation,indent=2)+'\n');print(json.dumps({'state':'START','at':start,'floor':floor,'free':free}),flush=True)
spec=importlib.util.spec_from_file_location('av_r3_ops',OPS);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TZ':'UTC','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1'}
r=m.supervise(m.Launch(cmd,str(R),env,m.Ownership.NEW_CHILD_SESSION,m.Capture.MERGED),m.Policy(27,1,2,131072))
(out/'output.log').write_bytes(r.stdout);rep=dataclasses.asdict(r);rep.pop('stdout');rep.pop('stderr')
closed=r.exit_code is not None and r.owned_state=='absent' and r.eof=={'stdout':True} and r.observed_bytes==r.retained_bytes==len(r.stdout) and not r.secondary_failures and not r.signals
cleanup={'closed':closed,'removed':False}
if closed:
 s=tmp.lstat();assert (s.st_dev,s.st_ino)==(identity.st_dev,identity.st_ino) and not tmp.is_symlink();assert not list(tmp.iterdir());tmp.rmdir()
 try:tmp.lstat();raise AssertionError('TMP remained')
 except FileNotFoundError:cleanup.update(removed=True,exactLstat='ENOENT',dev=identity.st_dev,ino=identity.st_ino,endEntries=0,endBytes=0)
paths=[Path(__file__),R/'packages/storage/migrations/036-plugin-verification-bindings.sql',R/'apps/server/src/plugin-runtime/verification-pg.test.ts',H/'inputs/packages/storage/migrations/036-plugin-verification-bindings.sql',H/'inputs/apps/server/src/plugin-runtime/verification-pg.test.ts',H/'tsconfig.json']
record={'at':stamp(),'startedAt':start,'sourceHashes':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},'supervision':rep,'cleanup':cleanup,'raw':{'bytes':len(r.stdout),'sha256':hashlib.sha256(r.stdout).hexdigest()},'elapsedBeforePersistenceSeconds':time.monotonic()-t,'scope':'affected strict only; zero PG/hooks/SQL execution; five real cases NOT_RUN after repair'}
(out/'result.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'state':'RETURN' if closed and cleanup['removed'] else 'UNKNOWN','at':record['at'],'pid':r.pid,'exit':r.exit_code,'elapsedMs':r.elapsed_ms,'eof':r.eof,'rawBytes':len(r.stdout),'cleanup':cleanup}),flush=True)
sys.exit(0 if r.exit_code==0 and closed and cleanup['removed'] else 1)
