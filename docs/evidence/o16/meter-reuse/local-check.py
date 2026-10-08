"""Two fixed local rounds; OPS14 owns child/group/output, no model or service entry."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, re, shutil, stat, sys, tempfile, time
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
SUP=Path('/Users/citrine/Projects/AgentHarness/Flow/tools/owned-process-supervision/supervise.py')
QUEUE=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
NODE='/opt/homebrew/opt/node@24/bin/node'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def save(path,value):
 data=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
 with path.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
def main():
 label=sys.argv[1];assert label in ['local-01','local-02']
 pattern=sys.argv[2] if len(sys.argv)>2 else '^O16 meter:|^O16 repair: measurement'
 assert pattern and len(pattern)<500
 out=HERE/label;out.mkdir(mode=0o700)
 old=[json.loads(p.read_text()) for p in HERE.glob('local-*/result.json')]
 used=sum(x['elapsedMs'] for x in old)
 assert used<30000
 queue=json.loads(QUEUE.read_text());floor=queue['futureCompleteFreshFloorBytes'];assert isinstance(floor,int) and floor>0
 added=4194304+262144+131072
 free=shutil.disk_usage(ROOT).free
 if free<floor+added:
  save(out/'not-run.json',dict(at=utc(),freeBytes=free,minimumFreshFreeBytes=floor+added,children=0));return 3
 assert hashlib.sha256(SUP.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
 scratch=Path(tempfile.mkdtemp(prefix='flow-o16-meter-local-',dir='/private/tmp'));initial=scratch.lstat()
 command=[NODE,'--import','tsx','--test','--experimental-test-isolation=none','--test-concurrency=1','--test-reporter=tap','--test-name-pattern',pattern,
  'experiments/continuous-goal-acceptance/owned-meter.test.mjs','experiments/continuous-goal-acceptance/operator.test.mjs']
 env={'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'TSX_DISABLE_CACHE':'1','NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1','FLOW_O16_METER_SCRATCH':str(scratch)}
 inputs=[Path(__file__).resolve(),SUP,ROOT/'experiments/continuous-goal-acceptance/operator.mjs',*[ROOT/'experiments/continuous-goal-acceptance'/x for x in ['operator-bounds.mjs','operator.test.mjs','owned-meter.mjs','owned-meter.test.mjs','meter-bridge.mjs']],Path('/Users/citrine/Projects/AgentHarness/Flow/tools/owned-resource-measurement/measure.py')]
 save(out/'reservation.json',dict(startedAt=utc(),head=os.popen('git rev-parse HEAD').read().strip(),command=command,scratch=str(scratch),dev=initial.st_dev,ino=initial.st_ino,freeBytes=free,floorBytes=floor,candidateBytes=added,queueSha256=hashlib.sha256(QUEUE.read_bytes()).hexdigest(),inputs=[dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in inputs],PG=0,provider=0,oldPrivateReads=0))
 spec=importlib.util.spec_from_file_location('o16_meter_local_ops14',SUP);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
 started=time.monotonic()
 report=m.supervise(m.Launch(tuple(command),str(ROOT),env,m.Ownership.NEW_CHILD_SESSION),m.Policy(23,.5,1.5,131072))
 elapsed=round((time.monotonic()-started)*1000)
 save(out/'stdout',report.stdout);save(out/'stderr',report.stderr)
 outer=dataclasses.asdict(report);outer.pop('stdout');outer.pop('stderr');save(out/'outer.json',outer)
 total=0;entries=0;valid=True
 for parent,dirs,files in os.walk(scratch,followlinks=False):
  for name in dirs+files:
   info=(Path(parent)/name).lstat();entries+=1
   if entries>2048 or info.st_uid!=os.getuid() or info.st_dev!=initial.st_dev or not(stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):valid=False;break
   if stat.S_ISREG(info.st_mode):total+=info.st_size
  if not valid:break
 current=scratch.lstat();same=(current.st_dev,current.st_ino)==(initial.st_dev,initial.st_ino)
 remove=same and valid and entries==0 and report.owned_state=='absent' and all(report.eof.values())
 if remove:scratch.rmdir()
 output=report.stdout.decode();passes=re.findall(r'^# pass (\d+)$',output,re.M);fails=re.findall(r'^# fail (\d+)$',output,re.M)
 selected=int(passes[-1])+int(fails[-1]) if passes and fails else None
 value=dict(finishedAt=utc(),elapsedMs=elapsed,selected=selected,passed=int(passes[-1]) if passes else None,failed=int(fails[-1]) if fails else None,rawBytes=len(report.stdout)+len(report.stderr),scratchBytes=total,scratchEntries=entries,sameIdentity=same,scratchRemoved=remove,ownedState=report.owned_state,eof=report.eof,firstFailure=outer['first_failure'],exitCode=report.exit_code)
 save(out/'result.json',value);print(json.dumps(value))
 return 0 if report.exit_code==0 and selected and not value['failed'] and valid and total<=4194304 and report.owned_state=='absent' and all(report.eof.values()) else 1
if __name__=='__main__':raise SystemExit(main())
