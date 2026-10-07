"""One bounded selected consumer run; OPS14 owns processes, test owns its marked DB."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, shutil, signal, stat, sys, tempfile, time
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SUP = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
METER = SUP.parent.parent / 'owned-resource-measurement/measure.py'
NODE = '/opt/homebrew/opt/node@24/bin/node'
PATTERN = '^keeps a newer connection when an older logout response arrives late$|^expires absolutely without read mutation and logout revokes only its session without cancelling task work$|^closes an already-open SSE on logout without cancelling its running task$|^requires exact trusted Origin and CSRF on cookie writes, allowing only same-origin safe browser reads without Origin$'
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def save(path, value):
 data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
 with path.open('xb') as file: file.write(data); file.flush(); os.fsync(file.fileno())
def module(name, path, expected):
 assert digest(path) == expected
 spec = importlib.util.spec_from_file_location(name, path); loaded = importlib.util.module_from_spec(spec); sys.modules[name] = loaded; spec.loader.exec_module(loaded); return loaded
def main():
 started = time.monotonic(); signal.signal(signal.SIGALRM, lambda *_: os._exit(124)); signal.setitimer(signal.ITIMER_REAL, 150)
 mode, label = sys.argv[1:]; assert mode in ['types','pg'] and label in ['types-01','types-02','pg-01','pg-02']
 prior = [json.loads(p.read_text()) for p in HERE.glob('*-*/operation-report.json')]
 used_ms = sum(v['elapsedMs'] for v in prior); assert used_ms < 120000
 out = HERE / label; assert not out.exists()
 free = shutil.disk_usage(ROOT).free; assert free >= 1073741824 + 134217728 + 16777216 + 2097152 + 536870912
 if mode == 'pg': assert (HERE / 'pg-window.json').is_file()
 supervisor = module('connection_supervisor', SUP, '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d')
 meter = module('connection_meter', METER, '52b92553302378ed44ec38550a02cb15b1d644d274547959fabed344f35e9d08')
 out.mkdir(); scratch = Path(tempfile.mkdtemp(prefix='flow-logout-', dir='/private/tmp')); identity = scratch.lstat()
 env = {'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'TSX_DISABLE_CACHE':'1','NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1'}
 if mode == 'types': argv = [NODE,str(ROOT/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(HERE/'focused-types.json')]
 else:
  env.update({'FLOW_CONNECTION01_RUN_DIRECTORY':str(out),'FLOW_CONNECTION01_EVIDENCE':str(out/'test-facts.json')})
  argv = [NODE,str(ROOT/'node_modules/vitest/vitest.mjs'),'run','apps/server/src/browser-session/session.test.ts','--no-cache','--configLoader','runner','-t',PATTERN]
 sources = [ROOT/'apps/server/src/browser-session'/name for name in ['index.ts','fixture.ts','session.test.ts','store.ts']]
 save(out/'reservation.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'command':argv,'source':{str(p.relative_to(ROOT)):digest(p) for p in sources},'callerSHA256':digest(Path(__file__)),'freeBytes':free,'priorElapsedMs':used_ms,'scratch':{'path':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino},'providerCalls':0,'selected':4 if mode=='pg' else None})
 remaining = 120 - used_ms/1000 - (time.monotonic()-started); assert remaining>8
 report = supervisor.supervise(supervisor.Launch(tuple(argv),str(ROOT),env,supervisor.Ownership.NEW_CHILD_SESSION),supervisor.Policy(min(100,remaining-8),.5,2,1048576))
 save(out/'stdout',report.stdout); save(out/'stderr',report.stderr)
 data = dataclasses.asdict(report); data.pop('stdout'); data.pop('stderr'); save(out/'supervision.json',data)
 measured = meter.measure(meter.Root(str(scratch),identity.st_dev,identity.st_ino),limits=meter.Limits(max_entries=2048,max_seconds=1))
 safe = measured.state=='complete' and measured.logical_bytes<=16777216 and measured.symlinks==0 and report.owned_state=='absent' and all(report.eof.values())
 current=scratch.lstat(); safe = safe and (current.st_dev,current.st_ino,current.st_uid)==(identity.st_dev,identity.st_ino,os.getuid())
 for directory, dirs, files in os.walk(scratch,followlinks=False):
  for name in dirs+files:
   item=(Path(directory)/name).lstat()
   safe = safe and item.st_uid==os.getuid() and item.st_dev==identity.st_dev and (stat.S_ISDIR(item.st_mode) or stat.S_ISREG(item.st_mode) and item.st_nlink==1)
 checkpoint={'measurement':dataclasses.asdict(measured),'safeScratchCleanup':safe,'scratchRemoved':False,'DBCleanupOwnedBy':'selected test; original marker/connections/drop records only'}
 save(out/'cleanup-checkpoint.json',checkpoint)
 if safe: shutil.rmtree(scratch)
 raw_bytes=sum(p.stat().st_size for d in HERE.glob('*-*') if d.is_dir() for p in d.iterdir() if p.is_file())
 result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'exitCode':report.exit_code,'firstFailure':report.first_failure,'ownedState':report.owned_state,'eof':report.eof,'scratchRemoved':not scratch.exists(),'scratchIdentity':{'dev':identity.st_dev,'ino':identity.st_ino},'elapsedMs':round((time.monotonic()-started)*1000),'priorElapsedMs':used_ms,'recordsBytesSoFar':raw_bytes,'providerCalls':0}
 save(out/'operation-report.json',result); print(json.dumps(result)); signal.setitimer(signal.ITIMER_REAL,0)
 return 0 if report.exit_code==0 and report.first_failure is None and safe and raw_bytes<2097152 else 1
if __name__=='__main__': raise SystemExit(main())
