from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,re,shutil,stat,sys,tempfile
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OPS=Path('/Users/citrine/Projects/AgentHarness/Flow/tools/owned-process-supervision/supervise.py')
QUEUE=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
NODE='/opt/homebrew/opt/node@24/bin/node'
VITEST='/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/vitest@4.0.18_@opentelemetry+api@1.9.1_@types+node@24.19.1_jiti@2.7.0_lightningcss@1.33.0_tsx@4.23.15/node_modules/vitest/vitest.mjs'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def save(path,value):
 data=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
 with path.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
def pin(p):
 b=p.read_bytes();return dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def main():
 label=sys.argv[1];assert label in ['runtime','environment','runtime-fix','types','types-fix']
 out=HERE/('local-'+label);out.mkdir(mode=0o700)
 old=[json.loads(p.read_bytes()) for p in HERE.glob('local-*/result.json')];used=sum(x['elapsedMs'] for x in old);assert used<30000
 queue=json.loads(QUEUE.read_bytes());floor=queue['futureCompleteFreshFloorBytes'];extra=8388608+131072;free=shutil.disk_usage(ROOT).free;assert free>=floor+extra
 assert hashlib.sha256(OPS.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
 scratch=Path(tempfile.mkdtemp(prefix='flow-svc09b-local-',dir='/private/tmp'));identity=scratch.stat()
 command=[NODE,'--test','--test-name-pattern=^SVC09B diagnostics:','tools/personal-preview/environment.test.mjs'] if label=='environment' else [NODE,VITEST,'run','--config',str(HERE/'vitest.config.mjs'),'apps/runner/src/runtime-terminal-admission.test.ts','--reporter=dot']
 if label in ['types','types-fix']: command=[NODE,'/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc','--project',str(HERE/'types.json'),'--noEmit']
 inputs=[ROOT/p for p in ['apps/runner/src/runtime.ts','apps/runner/src/runtime-terminal-admission.test.ts','apps/runner/src/outbox.ts','apps/runner/src/admission-journal.ts','tools/personal-preview/environment.mjs','tools/personal-preview/environment.test.mjs']]+[Path(__file__).resolve(),HERE/'vitest.config.mjs',OPS,Path(NODE).resolve(),Path(VITEST)]
 inputs += [HERE/'types.json'] if label in ['types','types-fix'] else []
 save(out/'reservation.json',dict(startedAt=utc(),argv=command,cwd=str(ROOT),inputs=[pin(p) for p in inputs],queueSha256=hashlib.sha256(QUEUE.read_bytes()).hexdigest(),floorBytes=floor,addedBytes=extra,freeBytes=free,priorChildMs=used,scratch=dict(path=str(scratch),dev=identity.st_dev,ino=identity.st_ino),PG=0,HTTP=0,provider=0,personal=0))
 spec=importlib.util.spec_from_file_location('svc09b_ops',OPS);ops=importlib.util.module_from_spec(spec);sys.modules[spec.name]=ops;spec.loader.exec_module(ops)
 env={'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'PYTHONDONTWRITEBYTECODE':'1','TSX_DISABLE_CACHE':'1','NODE_DISABLE_COMPILE_CACHE':'1'}
 seconds=min(8,(30000-used)/1000-2.5);assert seconds>0
 report=ops.supervise(ops.Launch(tuple(command),str(ROOT),env,ops.Ownership.NEW_CHILD_SESSION),ops.Policy(seconds,.5,2,65536))
 save(out/'stdout',report.stdout);save(out/'stderr',report.stderr);outer=dataclasses.asdict(report);outer.pop('stdout');outer.pop('stderr');save(out/'outer.json',outer)
 total=0;entries=0;valid=True
 for parent,dirs,files in os.walk(scratch,followlinks=False):
  for name in dirs+files:
   info=(Path(parent)/name).lstat();entries+=1
   if entries>4096 or info.st_uid!=os.getuid() or info.st_dev!=identity.st_dev or not(stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):valid=False;break
   if stat.S_ISREG(info.st_mode):total+=info.st_size
  if not valid:break
 now=scratch.stat();same=(now.st_dev,now.st_ino)==(identity.st_dev,identity.st_ino);remove=same and valid and entries==0 and report.owned_state=='absent' and all(report.eof.values())
 if remove:scratch.rmdir()
 value=dict(finishedAt=utc(),elapsedMs=report.elapsed_ms,exitCode=report.exit_code,firstFailure=outer['first_failure'],rawBytes=len(report.stdout)+len(report.stderr),ownedState=report.owned_state,eof=report.eof,scratchBytes=total,scratchEntries=entries,sameIdentity=same,scratchRemoved=remove)
 save(out/'result.json',value);print(json.dumps(value));return 0 if report.exit_code==0 and total<=8388608 and report.owned_state=='absent' and all(report.eof.values()) else 1
if __name__=='__main__':raise SystemExit(main())
