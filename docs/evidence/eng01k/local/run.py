"""ENG01K bounded local caller; existing OPS14 owns every spawned test process."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, shutil, signal, sys, tempfile, time
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
I02=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration')
SUPERVISOR=ROOT/'tools/owned-process-supervision/supervise.py'
NODE='/opt/homebrew/opt/node@24/bin/node'
def save(path,value):
 raw=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
 with path.open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
 fd=os.open(path.parent,os.O_RDONLY|os.O_NOFOLLOW)
 try:os.fsync(fd)
 finally:os.close(fd)
def main(mode,round_id,*selection):
 assert mode in ('tests','types') and round_id.isdigit() and len(round_id)==2
 start=time.monotonic();signal.signal(signal.SIGALRM,lambda *_:os._exit(124));signal.setitimer(signal.ITIMER_REAL,45)
 out=HERE/('round-'+round_id);out.mkdir()
 prior=[json.loads(p.read_text()) for p in HERE.glob('round-*/result.json')]
 used=sum(v['elapsedMs'] for v in prior);used_raw=sum(v['rawBytes'] for v in prior)
 assert used<180000 and used_raw<2097152
 free=shutil.disk_usage(ROOT).free
 if free<1107296256:save(out/'not-run.json',{'freeBytes':free,'gate':1107296256});return 3
 for value in json.loads((HERE/'installed-inputs.json').read_text()):
  path=Path(value['path']);assert str(path.resolve())==value['realpath'] and hashlib.sha256(path.read_bytes()).hexdigest()==value['sha256']
 assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
 scratch=Path(tempfile.mkdtemp(prefix='eng01k-local-',dir='/private/tmp'));identity=scratch.stat()
 env={'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1','FLOW_ENG01K_CACHE':str(scratch/'cache'),'FLOW_ENG01K_TMP':str(scratch)}
 command=[NODE,str(I02/'node_modules/vitest/vitest.mjs'),'run','--config',str(HERE/'vitest.config.mjs'),'--reporter=verbose'] if mode=='tests' else [NODE,str(I02/'node_modules/typescript/lib/tsc.js'),'-p',str(HERE/'tsconfig.json')]
 if selection:assert mode=='tests' and len(selection)==1;command+=['-t',selection[0]]
 sources=[ROOT/('apps/runner/src/engineering/'+p) for p in ('native-tool-writer.ts','native-tool-writer.test.ts','native-tool-policy.ts','native-tool-policy.test.ts')]
 sources += [Path(__file__).resolve(),HERE/'vitest.config.mjs',HERE/'tsconfig.json',SUPERVISOR]
 save(out/'reservation.json',{'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scratch':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino,'freeBytes':free,'priorMs':used,'mode':mode,'command':command,'sources':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},'provider':0,'PG':0})
 spec=importlib.util.spec_from_file_location('eng01k_supervisor',SUPERVISOR);module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
 work=min(30,(180000-used)/1000,40-(time.monotonic()-start))
 assert work>0
 report=module.supervise(module.Launch(tuple(command),str(ROOT),env,module.Ownership.NEW_CHILD_SESSION),module.Policy(work,.5,2,min(524288,2097152-used_raw)))
 save(out/'stdout',report.stdout);save(out/'stderr',report.stderr)
 value=dataclasses.asdict(report);value.pop('stdout');value.pop('stderr')
 private=sum(p.stat().st_size for p in scratch.rglob('*') if p.is_file() and not p.is_symlink());current=scratch.lstat()
 safe=(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino) and report.owned_state=='absent' and all(report.eof.values())
 value.update({'mode':mode,'privateBytes':private,'rawBytes':len(report.stdout)+len(report.stderr),'cleanupReady':safe,'removed':False})
 save(out/'checkpoint.json',value)
 if safe:shutil.rmtree(scratch)
 value.update({'removed':not scratch.exists(),'elapsedMs':round((time.monotonic()-start)*1000),'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 save(out/'result.json',value);print(json.dumps(value));signal.setitimer(signal.ITIMER_REAL,0)
 return 0 if report.exit_code==0 and report.first_failure is None and safe and private<=16777216 else 1
if __name__=='__main__':raise SystemExit(main(*sys.argv[1:]))
