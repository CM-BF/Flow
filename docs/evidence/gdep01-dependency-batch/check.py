"""Bounded 0PG local checks through the existing OPS14 supervisor."""
import dataclasses, datetime, hashlib, importlib.util, json, os, shutil, stat, sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence/gdep01-dependency-batch'
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('gdep_ops14', SUPERVISOR)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
label = sys.argv[1]; assert label in ('red', 'green', 'types', 'types-fixed', 'green-fixed')
record_path = EVIDENCE / 'iterations.json'
record = json.loads(record_path.read_text()) if record_path.exists() else {'runs': []}
assert len(record['runs']) < 5 and sum(r['elapsed_ms'] for r in record['runs']) < 60_000
assert all(r['resourceConfirmed'] for r in record['runs']) and all(r['label'] != label for r in record['runs'])
canonical = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
resource = json.loads(canonical.read_bytes()); forward = resource['forwardAdmission']; terms = forward['termsBytes']
assert all(isinstance(v, int) and v >= 0 for v in terms.values())
floor = forward['minimumFreshFreeBytes']; assert sum(terms.values()) == floor
free = shutil.disk_usage(ROOT).free; assert free >= floor
started = datetime.datetime.now(datetime.timezone.utc)
assert started < datetime.datetime(2026, 10, 7, 22, 28, 5, tzinfo=datetime.timezone.utc)
node = '/opt/homebrew/opt/node@24/bin/node'
argv = [node, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(EVIDENCE / 'vitest.config.ts'), '--configLoader', 'runner', '--no-cache']
if label.startswith('types'): argv = [node, str(ROOT / 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', str(EVIDENCE / 'types.tsconfig.json')]
scratch = Path('/tmp') / ('flow-gdep01-' + uuid.uuid4().hex); scratch.mkdir(mode=0o700)
identity = scratch.lstat(); marker = uuid.uuid4().hex
(scratch / 'owner.json').write_text(json.dumps({'marker': marker, 'dev': identity.st_dev, 'ino': identity.st_ino}))
files = ['apps/server/src/goals/commands.ts', 'apps/server/src/goals/dependency-content.ts', 'apps/server/src/goals/dependency-content.test.ts', 'docs/evidence/gdep01-dependency-batch/check.py', 'docs/evidence/gdep01-dependency-batch/vitest.config.ts', 'docs/evidence/gdep01-dependency-batch/types.tsconfig.json']
source = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in files}
raw = (EVIDENCE / (label + '.log')).open('xb')
reservation = {'at': started.isoformat(), 'sourceHashes': source, 'floor': floor, 'free': free, 'resourceRecordedAt': resource['recordedAt'], 'terms': terms, 'scratch': {'path': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino, 'marker': marker}, 'argv': argv}
(EVIDENCE / (label + '-started.json')).write_text(json.dumps(reservation, indent=2) + '\n')
env = {'PATH': '/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch), 'XDG_CACHE_HOME': str(scratch), 'CI': '1', 'NO_COLOR': '1', 'NODE_DISABLE_COMPILE_CACHE': '1'}
print(json.dumps({'event': 'START', 'label': label, 'at': started.isoformat(), 'free': free, 'floor': floor}), flush=True)
report = ops.supervise(ops.Launch(tuple(argv), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(24, 2, 4, 100_000))
raw.write(report.stdout); raw.close()
facts = dataclasses.asdict(report); facts.pop('stdout'); facts.pop('stderr')
closed = report.exit_code is not None and report.owned_state == 'absent' and report.capture == 'merged' and report.eof == {'stdout': True} and report.observed_bytes == report.retained_bytes == len(report.stdout) and (report.first_failure is None or report.first_failure['code'] == 'CHILD_EXIT_NONZERO') and not report.secondary_failures and not report.signals
cleanup = 'KEEP'; scratch_bytes = None
if closed:
    current = scratch.lstat(); assert stat.S_ISDIR(current.st_mode) and (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino)
    assert json.loads((scratch / 'owner.json').read_text())['marker'] == marker
    scratch_bytes = sum(p.lstat().st_size for p in scratch.rglob('*') if p.is_file() and not p.is_symlink())
    assert scratch_bytes <= 1_000_000
    shutil.rmtree(scratch)
    try: scratch.lstat()
    except FileNotFoundError: cleanup = 'REMOVED_EXACT_ENOENT'
facts.update(label=label, endedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), resourceConfirmed=closed, scratchCleanup=cleanup, scratchBytes=scratch_bytes, rawSha256=hashlib.sha256(report.stdout).hexdigest(), sourceHashes=source)
record['runs'].append(facts); record_path.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'event': 'RETURN', 'label': label, 'at': facts['endedAt'], 'pid': report.pid, 'pgid': report.pid, 'exit': report.exit_code, 'elapsedMs': report.elapsed_ms, 'closed': closed, 'eof': report.eof, 'scratch': cleanup}), flush=True)
sys.exit(0 if closed else 2)
