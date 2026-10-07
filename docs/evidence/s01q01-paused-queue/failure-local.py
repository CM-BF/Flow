"""One bounded local iteration record; never starts PostgreSQL or HTTP."""
import dataclasses
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence/s01q01-paused-queue'
OUTPUT = EVIDENCE / 'failure-local'
NODE = '/opt/homebrew/opt/node@24/bin/node'
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('s01q01_ops14', SUPERVISOR)
ops = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = ops
spec.loader.exec_module(ops)

label = sys.argv[1]
budget = label.startswith('budget-')
preparation = label.startswith('prepare-') or budget
if preparation:
    OUTPUT = EVIDENCE / ('admission-local' if budget else 'preparation-local')
    OUTPUT.mkdir(exist_ok=True)
assert label.startswith('budget-') or label in ('red', 'green', 'types', 'types-fixed', 'green-fixed', 'prepare-types', 'prepare-collect', 'prepare-caller', 'prepare-types-fixed', 'prepare-collect-fixed', 'prepare-caller-fixed')
record_path = OUTPUT / 'iterations.json'
record = json.loads(record_path.read_text()) if record_path.exists() else {'runs': []}
assert len(record['runs']) < 5 and sum(run['elapsed_ms'] for run in record['runs']) < 60_000
assert all(run['resourceConfirmed'] for run in record['runs'])
assert not any(run['label'] == label for run in record['runs'])
free = shutil.disk_usage(ROOT).free
floor = 18_632_540_160 if budget else 18_520_211_456 if preparation else 17_950_834_688
assert free >= floor
started = datetime.datetime.now(datetime.timezone.utc)
deadline = datetime.datetime(2026, 10, 7, 20, 25, 50, tzinfo=datetime.timezone.utc) if budget else datetime.datetime(2026, 10, 7, 19, 53, 50, tzinfo=datetime.timezone.utc)
assert started < deadline
scratch = Path('/tmp') / ('flow-s01q01-' + uuid.uuid4().hex)
scratch.mkdir(mode=0o700)
identity = scratch.stat()
marker = uuid.uuid4().hex
(scratch / 'owner.json').write_text(json.dumps({'marker': marker, 'dev': identity.st_dev, 'ino': identity.st_ino}))
raw_file = (OUTPUT / (label + '.log')).open('xb')
files = ['pg-fixture.ts', 'pg-fixture.test.ts', 'failure.vitest.config.ts', 'failure.types.tsconfig.json', 'failure-local.py']
if preparation: files += ['queue.vitest.config.ts', 'entry.py', 'entry.test.py', 'types.tsconfig.json']
source = {name: hashlib.sha256((EVIDENCE / name).read_bytes()).hexdigest() for name in files}
argv = [NODE, str(EVIDENCE / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(EVIDENCE / 'failure.vitest.config.ts'), '--configLoader', 'runner', '--no-cache']
if label == 'red': argv += ['-t', 'propagates admin failure']
if label.startswith('types'): argv = [NODE, str(EVIDENCE / 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', str(EVIDENCE / 'failure.types.tsconfig.json')]
if label.startswith(('prepare-types', 'budget-types')): argv = [NODE, str(EVIDENCE / 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', str(EVIDENCE / 'types.tsconfig.json')]
if label == 'budget-types-fixture': argv = [NODE, str(EVIDENCE / 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', str(EVIDENCE / 'failure.types.tsconfig.json')]
if label.startswith('prepare-collect'): argv = [NODE, str(EVIDENCE / 'node_modules/vitest/vitest.mjs'), 'list', '--config', str(EVIDENCE / 'queue.vitest.config.ts'), '--configLoader', 'runner', '--no-cache', '--json', '-t', '^(' + 'skips more than a default batch of paused queues without rotating them and scans again after explicit resume|keeps pause CAS authoritative when a candidate scan races promotion' + ')$']
if label.startswith(('prepare-caller', 'budget-caller')): argv = ['/opt/homebrew/bin/python3.13', '-I', '-B', str(EVIDENCE / 'entry.test.py')]
env = {'PATH': '/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch), 'XDG_CACHE_HOME': str(scratch), 'CI': '1', 'NO_COLOR': '1'}
(OUTPUT / (label + '-started.json')).write_text(json.dumps({'at': started.isoformat(), 'freeBytes': free, 'floorBytes': floor, 'sourceHashes': source, 'scratch': {'path': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino, 'marker': marker}}, indent=2) + '\n')
report = ops.supervise(ops.Launch(tuple(argv), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(24, 2, 4, 262144))
raw_file.write(report.stdout)
raw_file.close()
facts = dataclasses.asdict(report)
facts.pop('stdout'); facts.pop('stderr')
closed = report.exit_code is not None and report.owned_state == 'absent' and report.capture == 'merged' and report.eof == {'stdout': True} and report.observed_bytes == report.retained_bytes == len(report.stdout) and (report.first_failure is None or report.first_failure['code'] == 'CHILD_EXIT_NONZERO') and not report.secondary_failures and not report.signals
cleanup = 'KEEP'
if closed:
    current = scratch.lstat()
    assert current.st_dev == identity.st_dev and current.st_ino == identity.st_ino and not scratch.is_symlink()
    assert json.loads((scratch / 'owner.json').read_text())['marker'] == marker
    shutil.rmtree(scratch)
    try: scratch.lstat()
    except FileNotFoundError: cleanup = 'REMOVED_EXACT_ENOENT'
facts.update(label=label, endedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), resourceConfirmed=closed, scratchCleanup=cleanup, rawSha256=hashlib.sha256(report.stdout).hexdigest(), sourceHashes=source)
record['runs'].append(facts)
record_path.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'label': label, 'pid': report.pid, 'exit': report.exit_code, 'elapsedMs': report.elapsed_ms, 'closed': closed, 'scratch': cleanup}), flush=True)
sys.exit(0 if closed else 2)
