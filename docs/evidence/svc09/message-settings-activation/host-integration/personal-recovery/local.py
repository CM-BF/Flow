"""Two small serial consumers under the existing OPS14 module, no product runtime."""
from pathlib import Path
from dataclasses import asdict
import datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
NODE = Path('/opt/homebrew/Cellar/node@24/24.20.0/bin/node')
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
QUEUE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json')
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
assert len(sys.argv) == 2 and sys.argv[1] in ['01', '02', '03']
queue_bytes = QUEUE.read_bytes(); queue = json.loads(queue_bytes)
floor = max(16635330560, queue['floor']); free = shutil.disk_usage(HERE).free
assert free >= floor, 'COMPLETE_FORWARD_FLOOR'
run = HERE / ('local-' + sys.argv[1]); run.mkdir()
def save(name, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(run / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream: stream.write(data); stream.flush(); os.fsync(stream.fileno())
def pin(path):
    data = path.read_bytes(); return {'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
spec = importlib.util.spec_from_file_location('recovery_local_ops14', SUPERVISOR)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
scratch = Path(tempfile.mkdtemp(prefix='flow-svc09-held-local-', dir='/private/tmp')); identity = scratch.lstat()
commands = [(str(NODE), '--test', '--test-isolation=none', '--test-reporter=spec', str(HERE / 'policy.test.mjs')),
            (sys.executable, '-B', str(HERE / 'run.test.py'))]
prior = [json.loads(p.read_text()) for p in HERE.glob('local-*/result.json')]
used = sum(r['elapsedMs'] for item in prior for r in item['reports']); raw = sum(r['rawBytes'] for item in prior for r in item['reports'])
save('reservation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'inputs': [pin(p) for p in sorted(HERE.glob('*.mjs'))] + [pin(HERE/'run.py'),pin(HERE/'run.test.py'),pin(Path(__file__)),pin(SUPERVISOR),pin(NODE)],
 'queue': {'path': str(QUEUE), 'at': queue['at'], 'sha256': hashlib.sha256(queue_bytes).hexdigest()}, 'minimumFreeBytes': floor,'freeBytes':free,
 'priorMs':used,'priorRawBytes':raw,'secondsLimit':30,'rawLimit':131072,'scratchLimit':8388608,'commands':commands,
 'scratch':{'path':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino},'PG':0,'provider':0,'personal':0})
reports=[]
for i, command in enumerate(commands):
    remaining = 30 - (used + sum(r.elapsed_ms for r in reports)) / 1000
    assert remaining > 2.5
    report=ops.supervise(ops.Launch(command,str(HERE),{'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'PYTHONDONTWRITEBYTECODE':'1','NODE_DISABLE_COMPILE_CACHE':'1'},ops.Ownership.NEW_CHILD_SESSION),ops.Policy(remaining-2.5,.5,2,131072-raw-sum(r.observed_bytes for r in reports)))
    reports.append(report); save(str(i+1)+'-stdout.txt',report.stdout);save(str(i+1)+'-stderr.txt',report.stderr)
    value=asdict(report);value.pop('stdout');value.pop('stderr');save(str(i+1)+'-outer.json',value)
    if report.exit_code or report.first_failure or report.owned_state!='absent' or not all(report.eof.values()):break
after=scratch.lstat();closed=all(r.owned_state=='absent' and all(r.eof.values()) for r in reports);empty=not list(scratch.iterdir());cleanup='KEEP'
if closed and empty and (after.st_dev,after.st_ino)==(identity.st_dev,identity.st_ino):scratch.rmdir();cleanup='removed'
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reports':[{'exit':r.exit_code,'elapsedMs':r.elapsed_ms,'rawBytes':r.observed_bytes,'ownedState':r.owned_state,'eof':r.eof,'firstFailure':r.first_failure} for r in reports],'cleanup':cleanup,'scratch':str(scratch),'pg':0,'provider':0,'personal':0}
save('result.json',result);print(json.dumps(result));raise SystemExit(0 if closed and cleanup=='removed' and len(reports)==2 and all(r.exit_code==0 for r in reports) else 1)
