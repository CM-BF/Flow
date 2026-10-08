"""Fixed two-child local segment; OPS14 retains child/group/deadline ownership."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, re, shutil, stat, sys, tempfile
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
OPS=Path('/Users/citrine/Projects/AgentHarness/Flow/tools/owned-process-supervision/supervise.py')
QUEUE=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
NODE='/opt/homebrew/opt/node@24/bin/node'
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def save(path,value):
    data=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
    with path.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
def pin(p):
    b=p.read_bytes();return dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def main():
    label=sys.argv[1];assert label in ['node','python']
    out=HERE/('local-'+label);out.mkdir(mode=0o700)
    queue=json.loads(QUEUE.read_bytes());floor=queue['futureCompleteFreshFloorBytes'];assert isinstance(floor,int) and floor>0
    added=8388608+131072+262144;free=shutil.disk_usage(ROOT).free
    if free<floor+added:save(out/'not-run.json',dict(at=utc(),free=free,floor=floor+added,child=0));return 3
    assert hashlib.sha256(OPS.read_bytes()).hexdigest()=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
    scratch=Path(tempfile.mkdtemp(prefix='flow-svc09-settings-local-',dir='/private/tmp'));identity=scratch.stat()
    command=[NODE,'--no-warnings','--experimental-vm-modules','--test','--test-reporter=tap','--test-name-pattern=^settings ',str(HERE/'public-entry.test.mjs')] if label=='node' else [sys.executable,'-B',str(HERE/'build-dispatch.test.py')]
    source=Path(json.loads((HERE/'build-inputs.json').read_bytes())['sourceDirectory'])
    files=[Path(__file__).resolve(),OPS,HERE/'public-entry.test.mjs',HERE/'build-dispatch.test.py',HERE/'build-inputs.json',HERE/'build-preparation.json',HERE/'build-entry.mjs',HERE/'build-supervise.py',HERE.parent/'host-integration/build/supervise.py']
    files += [source/'tools/personal-preview'/n for n in ['preview.mjs','backend-release/host.mjs','runner-slots.mjs','startup-diagnostics.mjs','backend-release/files.mjs']]
    save(out/'reservation.json',dict(startedAt=utc(),argv=command,inputs=[pin(p) for p in files],queueSha256=hashlib.sha256(QUEUE.read_bytes()).hexdigest(),floorBytes=floor,candidateBytes=added,freeBytes=free,scratch=dict(path=str(scratch),dev=identity.st_dev,ino=identity.st_ino),PG=0,build=0,provider=0,personal=0))
    spec=importlib.util.spec_from_file_location('svc09_local_ops',OPS);ops=importlib.util.module_from_spec(spec);sys.modules[spec.name]=ops;spec.loader.exec_module(ops)
    env={'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'PYTHONDONTWRITEBYTECODE':'1','TSX_DISABLE_CACHE':'1','NODE_DISABLE_COMPILE_CACHE':'1'}
    report=ops.supervise(ops.Launch(tuple(command),str(ROOT),env,ops.Ownership.NEW_CHILD_SESSION),ops.Policy(12,.5,2,65536))
    save(out/'stdout',report.stdout);save(out/'stderr',report.stderr)
    outer=dataclasses.asdict(report);outer.pop('stdout');outer.pop('stderr');save(out/'outer.json',outer)
    total=0;entries=0;valid=True
    for parent,dirs,files in os.walk(scratch,followlinks=False):
        for name in dirs+files:
            info=(Path(parent)/name).lstat();entries+=1
            if entries>4096 or info.st_uid!=os.getuid() or info.st_dev!=identity.st_dev or not(stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):valid=False;break
            if stat.S_ISREG(info.st_mode):total+=info.st_size
        if not valid:break
    current=scratch.stat();same=(current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino)
    remove=same and valid and entries==0 and report.owned_state=='absent' and all(report.eof.values())
    if remove:scratch.rmdir()
    text=report.stdout.decode()+'\n'+report.stderr.decode()
    selected=re.findall(r'^# tests (\d+)$',text,re.M) if label=='node' else re.findall(r'Ran (\d+) tests?',text)
    value=dict(finishedAt=utc(),elapsedMs=report.elapsed_ms,selected=int(selected[-1]) if selected else None,exitCode=report.exit_code,firstFailure=outer['first_failure'],rawBytes=len(report.stdout)+len(report.stderr),ownedState=report.owned_state,eof=report.eof,scratchBytes=total,scratchEntries=entries,sameIdentity=same,scratchRemoved=remove)
    save(out/'result.json',value);print(json.dumps(value))
    return 0 if report.exit_code==0 and selected and int(selected[-1])>0 and total<=8388608 and report.owned_state=='absent' and all(report.eof.values()) else 1
if __name__=='__main__':raise SystemExit(main())
