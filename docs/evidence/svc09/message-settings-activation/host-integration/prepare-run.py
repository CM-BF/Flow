"""One local definition-import/parameter check; no host, native, database or install."""
from pathlib import Path
from dataclasses import asdict
import ast, datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
MODULE = ROOT / 'tools/owned-process-supervision/supervise.py'
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc09a_prepare_ops14', MODULE)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
assert sys.argv[1:] in ([], ['--host-guard'])
host_guard = sys.argv[1:] == ['--host-guard']
run = HERE / ('prepare-local-02' if host_guard else 'prepare-local-01'); run.mkdir()

def save(name, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(run/name, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())

free = shutil.disk_usage(ROOT).free
assert free >= 1024**3 + 2*1024**2 + 256*1024
scratch = Path(tempfile.mkdtemp(prefix='flow-svc09a-host-preparation-' if host_guard else 'flow-svc09a-prepare-',dir='/private/tmp')); before = scratch.lstat()
argv = (NODE, '--test', '--test-reporter=spec', str(HERE/'host-prepare.test.mjs')) if host_guard else (NODE, str(HERE/'prepare-check.mjs'))
inputs = ['host-consumer.mjs','mixed-runner.mjs','prepare-check.mjs','prepare-run.py']
if host_guard:
    inputs += ['host-entry.mjs','host-fixture.mjs','host-records.mjs','host-cleanup.mjs','host-run.py','measure-once.py','host-prepare.test.mjs','host-inputs.json']
    for name in ['host-run.py','measure-once.py']:
        ast.parse((HERE/name).read_text())
save('reservation.json', {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv,'freeBytes':free,
  'runtimeBudgetSeconds':10,'rawBytesCap':262144,'scratchBytesCap':2097152,'scratch':str(scratch),'dev':before.st_dev,'ino':before.st_ino,
  'pythonAST': 'PASS' if host_guard else 'NOT_SELECTED',
  'inputs':[{'path':n,'bytes':(HERE/n).stat().st_size,'sha256':hashlib.sha256((HERE/n).read_bytes()).hexdigest()} for n in inputs]})
report = ops.supervise(ops.Launch(argv,str(ROOT),{'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'NODE_DISABLE_COMPILE_CACHE':'1',
    'FLOW_SVC09A_PREPARE_SCRATCH':str(scratch)},ops.Ownership.NEW_CHILD_SESSION),ops.Policy(8,.5,1,262144))
save('stdout.txt',report.stdout);save('stderr.txt',report.stderr)
v=asdict(report);v.pop('stdout');v.pop('stderr');save('result.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'report':v,'rawBytes':len(report.stdout)+len(report.stderr)})
after=scratch.lstat(); remaining=list(scratch.iterdir()); cleanup='KEEP'
if report.owned_state=='absent' and all(report.eof.values()) and (before.st_dev,before.st_ino)==(after.st_dev,after.st_ino) and not remaining:
    scratch.rmdir();cleanup='removed'
save('cleanup.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'state':cleanup,'scratch':str(scratch),'dev':before.st_dev,'ino':before.st_ino,'remainingEntries':len(remaining),'ownedState':report.owned_state,'eof':report.eof})
print(json.dumps({'exit':report.exit_code,'elapsedMs':report.elapsed_ms,'rawBytes':len(report.stdout)+len(report.stderr),'ownedState':report.owned_state,'eof':report.eof,'cleanup':cleanup}))
raise SystemExit(0 if report.exit_code==0 and report.owned_state=='absent' and all(report.eof.values()) and cleanup=='removed' else 1)
