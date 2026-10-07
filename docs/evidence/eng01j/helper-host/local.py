"""Bounded local checks only; never invoke the stock helper or a service."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, shutil, signal, sys, tempfile, time
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
SUPERVISOR = ROOT/'tools/owned-process-supervision/supervise.py'
NODE = '/opt/homebrew/opt/node@24/bin/node'
I02 = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration')

def save(path, value):
    raw = value if isinstance(value, bytes) else (json.dumps(value, indent=2)+'\n').encode()
    with path.open('xb') as stream: stream.write(raw); stream.flush(); os.fsync(stream.fileno())
    fd=os.open(path.parent,os.O_RDONLY|os.O_NOFOLLOW)
    try: os.fsync(fd)
    finally: os.close(fd)

def main(mode, round_id):
    assert mode in ('tests','types') and round_id.isdigit() and len(round_id)==2
    started=time.monotonic(); signal.signal(signal.SIGALRM,lambda *_:os._exit(124)); signal.setitimer(signal.ITIMER_REAL,20)
    out=HERE/('round-'+round_id); out.mkdir()
    used=sum(json.loads(p.read_text())['elapsedMs'] for p in HERE.glob('round-*/result.json'))
    if used>=40000: raise RuntimeError('LOCAL_SEGMENT_EXHAUSTED')
    fs=os.statvfs(ROOT);free=fs.f_bavail*fs.f_frsize
    if free<1107296256: save(out/'not-run.json',{'freeBytes':free,'gate':1107296256}); return 3
    assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
    scratch=Path(tempfile.mkdtemp(prefix='eng01j-helper-check-',dir='/private/tmp'));identity=scratch.stat()
    sources=[ROOT/('apps/runner/src/engineering/'+name) for name in ('native-authority.ts','native-authority.test.ts','native-authority-darwin.ts','native-authority-darwin.test.ts')]
    sources += [Path(__file__).resolve(),HERE/'startup-input.sb',SUPERVISOR,HERE.parent/'local/vitest.config.mjs',HERE.parent/'local/tsconfig.json']
    env={'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1','FLOW_ENG01J_CACHE':str(scratch/'cache'),'FLOW_ENG01J_HELPER_PREPARE':'1','FLOW_ENG01J_HELPER_SCRATCH':str(scratch)}
    command=[NODE,str(I02/'node_modules/vitest/vitest.mjs'),'run','--config',str(HERE.parent/'local/vitest.config.mjs'),'--reporter=verbose','-t','stock helper'] if mode=='tests' else [NODE,str(I02/'node_modules/typescript/lib/tsc.js'),'-p',str(HERE.parent/'local/tsconfig.json')]
    save(out/'reservation.json',{'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scratch':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino,'freeBytes':free,'previousMs':used,'mode':mode,'command':command,'source':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},'nativeStarts':0,'PG':0,'provider':0})
    spec=importlib.util.spec_from_file_location('owned_supervise',SUPERVISOR);module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    remaining=18-(time.monotonic()-started)-1
    if remaining<=0: raise RuntimeError('NO_CHILD_DEADLINE')
    report=module.supervise(module.Launch(tuple(command),str(ROOT),env,module.Ownership.NEW_CHILD_SESSION),module.Policy(min(15,remaining),.2,.8,65536))
    save(out/'stdout',report.stdout);save(out/'stderr',report.stderr)
    value=dataclasses.asdict(report);value.pop('stdout');value.pop('stderr')
    files=[p for p in scratch.rglob('*') if p.is_file() and not p.is_symlink()]
    private_bytes=sum(p.stat().st_size for p in files); current=scratch.lstat()
    safe=(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino) and report.owned_state=='absent' and all(report.eof.values())
    value.update({'mode':mode,'privateBytes':private_bytes,'rawBytes':len(report.stdout)+len(report.stderr),'identityMatched':(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino),'cleanupReady':safe,'removed':False})
    save(out/'checkpoint.json',value)
    if safe: shutil.rmtree(scratch)
    value.update({'removed':not scratch.exists(),'elapsedMs':round((time.monotonic()-started)*1000),'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    save(out/'result.json',value);print(json.dumps(value))
    signal.setitimer(signal.ITIMER_REAL,0)
    return 0 if report.exit_code==0 and report.first_failure is None and safe and private_bytes+value['rawBytes']<4*1024*1024 else 1

if __name__=='__main__':raise SystemExit(main(*sys.argv[1:]))
