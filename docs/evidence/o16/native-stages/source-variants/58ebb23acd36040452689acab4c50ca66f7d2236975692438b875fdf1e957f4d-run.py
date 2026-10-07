"""O16 finite stage-policy and changed decision consumers; no PG or SDK. OPS14 owns the sole child and capture."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, shutil, signal, stat, sys, tempfile, time
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
SUP=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
NODE='/opt/homebrew/opt/node@24/bin/node'
def save(path,value):
 b=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
 with path.open('xb') as f:f.write(b);f.flush();os.fsync(f.fileno())
 fd=os.open(path.parent,os.O_RDONLY|os.O_NOFOLLOW)
 try:os.fsync(fd)
 finally:os.close(fd)
def main():
 start=time.monotonic();signal.signal(signal.SIGALRM,lambda *_:os._exit(124));signal.setitimer(signal.ITIMER_REAL,30)
 label=sys.argv[1];assert label in ['run-01','run-02','run-03','run-04']
 out=HERE/label;out.mkdir()
 prior=list(HERE.glob('run-*/result.json'));assert sum(json.loads(p.read_text())['elapsedMs'] for p in prior)<180000
 free=shutil.disk_usage(ROOT).free
 if free<1107296256:save(out/'not-run.json',{'freeBytes':free,'requiredBytes':1107296256});return 3
 assert hashlib.sha256(SUP.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
 scratch=Path(tempfile.mkdtemp(prefix='flow-o16-stages-',dir='/private/tmp'));initial=scratch.lstat()
 command=[NODE,'--import','tsx','--test','--test-concurrency=1']
 if len(sys.argv)>2:command+=['--test-name-pattern',sys.argv[2]]
 command+=['experiments/continuous-goal-acceptance/stage-policy.test.mjs','experiments/continuous-goal-acceptance/decision-checkpoint.test.mjs','experiments/continuous-goal-acceptance/decision.test.mjs']
 env={'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'TSX_DISABLE_CACHE':'1','NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1'}
 files=[Path(__file__).resolve(),SUP,*sorted((ROOT/'experiments/continuous-goal-acceptance').glob('*.mjs'))]
 save(out/'reservation.json',{'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scratch':str(scratch),'dev':initial.st_dev,'ino':initial.st_ino,'freeBytes':free,'command':command,'bindings':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},'PG':0,'provider':0})
 spec=importlib.util.spec_from_file_location('o16_load_supervision',SUP);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
 remaining=30-(time.monotonic()-start);assert remaining>7
 report=m.supervise(m.Launch(tuple(command),str(ROOT),env,m.Ownership.NEW_CHILD_SESSION),m.Policy(min(23,remaining-6),.5,1,131072))
 save(out/'stdout',report.stdout);save(out/'stderr',report.stderr)
 value=dataclasses.asdict(report);value.pop('stdout');value.pop('stderr');bytes_count=0;entries=0;valid=True
 for parent,dirs,files in os.walk(scratch,followlinks=False):
  for name in dirs+files:
   p=Path(parent)/name;i=p.lstat();entries+=1
   if entries>2048 or i.st_uid!=os.getuid() or i.st_dev!=initial.st_dev or not(stat.S_ISDIR(i.st_mode) or stat.S_ISREG(i.st_mode)):valid=False;break
   if stat.S_ISREG(i.st_mode):bytes_count+=i.st_size
  if not valid:break
 current=scratch.lstat();safe=valid and bytes_count<=16777216 and (current.st_dev,current.st_ino)==(initial.st_dev,initial.st_ino) and report.owned_state=='absent' and all(report.eof.values())
 value.update({'privateBytes':bytes_count,'entries':entries,'rawBytes':len(report.stdout)+len(report.stderr),'cleanupReady':safe,'removed':False})
 save(out/'checkpoint.json',value)
 if safe:shutil.rmtree(scratch)
 value.update({'removed':not scratch.exists(),'elapsedMs':round((time.monotonic()-start)*1000),'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 save(out/'result.json',value);assert sum(p.stat().st_size for d in HERE.glob('run-*') if d.is_dir() for p in d.iterdir() if p.is_file())<=2097152
 print(json.dumps(value));signal.setitimer(signal.ITIMER_REAL,0)
 return 0 if report.exit_code==0 and report.first_failure is None and safe else 1
if __name__=='__main__':raise SystemExit(main())
