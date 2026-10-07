"""Small serial direct consumers; OPS14 remains the only child supervisor."""
from pathlib import Path
from dataclasses import asdict
import datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
NODE = Path('/opt/homebrew/Cellar/node@24/24.20.0/bin/node')
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('startup_ops14', SUPERVISOR)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
assert len(sys.argv) == 2 and sys.argv[1] in ('01', '02', '03')
run = HERE / ('startup-progress-local-' + sys.argv[1]); run.mkdir()
def save(name, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(run / name, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())
def pin(path):
    p = Path(path); data = p.read_bytes()
    return {'path': str(p), 'realpath': str(p.resolve()), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
prior = [json.loads(p.read_text()) for p in HERE.glob('startup-progress-local-*/result.json')]
used_ms = sum(r['elapsedMs'] for p in prior for r in p['reports'])
used_raw = sum(r['rawBytes'] for p in prior for r in p['reports'])
free = shutil.disk_usage(ROOT).free
assert used_ms < 120000 and used_raw < 131072 and free >= 1024**3 + 8*1024**2 + 131072
scratch = Path(tempfile.mkdtemp(prefix='flow-svc09a-startup-', dir='/private/tmp')); before = scratch.lstat()
vitest = ROOT / 'node_modules/vitest/vitest.mjs'
tsc = Path('/Users/citrine/Projects/AgentHarness/Flow/node_modules/typescript/bin/tsc').resolve()
commands = [(str(NODE), str(vitest), 'run', '--config', str(HERE / 'startup-progress-vitest.config.mjs'), '--reporter=verbose'),
 (str(NODE), '--test', '--test-reporter=spec', '--test-name-pattern=startup progress', str(ROOT / 'tools/personal-preview/environment.test.mjs')),
 (str(NODE), str(tsc), '-p', str(HERE / 'startup-progress-tsconfig.json'))]
if sys.argv[1] != '01':
    commands = [(str(NODE), '--experimental-vm-modules', '--test', '--test-reporter=spec', str(HERE / 'startup-entry-consumer.test.mjs')),
      (str(NODE), str(tsc), '-p', str(HERE / 'startup-entry-tsconfig.json'))]
paths = [ROOT / ('apps/server/src/' + p) for p in ('startup-progress.ts', 'startup-progress.test.ts', 'startup-progress-consumer.test.ts')]
paths += [ROOT / ('tools/personal-preview/' + p) for p in ('environment.mjs', 'environment.test.mjs', 'browser-session-configuration.mjs', 'startup-diagnostics.mjs')]
paths += [Path(__file__), HERE / 'startup-progress-vitest.config.mjs', HERE / 'startup-progress-tsconfig.json', SUPERVISOR, NODE, Path(sys.executable).resolve(), vitest, tsc, ROOT / 'node_modules/vitest/package.json']
if sys.argv[1] != '01':
    paths += [ROOT / 'apps/server/src/main.ts', ROOT / 'apps/server/src/index.ts', HERE / 'startup-entry-consumer.test.mjs', HERE / 'startup-entry-tsconfig.json', HERE / 'startup-progress-entry-inputs.json', HERE / 'startup-progress-entry-links.json', tsc.parent.parent / 'lib/typescript.js']
    paths += [Path('/Users/citrine/Projects/AgentHarness/Flow') / p for p in ('apps/server/src/main.ts', 'apps/server/src/index.ts')]
save('reservation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'inputs': [pin(p) for p in paths], 'commands': commands,
 'cumulativeSecondsCap': 120, 'priorMs': used_ms, 'rawBytesCap': 131072, 'priorRawBytes': used_raw, 'scratchBytesCap': 8388608,
 'freeBytes': free, 'scratch': str(scratch), 'dev': before.st_dev, 'ino': before.st_ino, 'pg': 0, 'provider': 0})
reports = []
for index, command in enumerate(commands):
    remaining_ms = 120000 - used_ms - sum(r.elapsed_ms for r in reports)
    remaining_raw = 131072 - used_raw - sum(len(r.stdout) + len(r.stderr) for r in reports)
    assert remaining_ms > 2500 and remaining_raw > 0
    r = ops.supervise(ops.Launch(command, str(ROOT), {'PATH': '/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch),
      'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1', 'FLOW_STARTUP_PROGRESS_SCRATCH': str(scratch)}, ops.Ownership.NEW_CHILD_SESSION),
      ops.Policy(min(30, remaining_ms / 1000 - 2.5), .5, 2, remaining_raw))
    reports.append(r); save(f'{index+1:02}-stdout.txt', r.stdout); save(f'{index+1:02}-stderr.txt', r.stderr)
    value = asdict(r); value.pop('stdout'); value.pop('stderr'); save(f'{index+1:02}-outer.json', value)
    if r.exit_code != 0 or r.owned_state != 'absent' or not all(r.eof.values()): break
after = scratch.lstat(); remaining = list(scratch.iterdir()); cleanup = 'KEEP'
closed = all(r.owned_state == 'absent' and all(r.eof.values()) for r in reports)
if closed and (before.st_dev, before.st_ino) == (after.st_dev, after.st_ino) and not remaining:
    scratch.rmdir(); cleanup = 'removed'
summary = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'reports': [
 {'exit': r.exit_code, 'elapsedMs': r.elapsed_ms, 'rawBytes': len(r.stdout)+len(r.stderr), 'ownedState': r.owned_state, 'eof': r.eof, 'firstFailure': r.first_failure} for r in reports],
 'scratch': {'path': str(scratch), 'dev': before.st_dev, 'ino': before.st_ino, 'remainingEntries': len(remaining), 'cleanup': cleanup}, 'pg': 0, 'provider': 0}
save('result.json', summary); print(json.dumps(summary))
raise SystemExit(0 if all(r.exit_code == 0 for r in reports) and closed and cleanup == 'removed' else 1)
