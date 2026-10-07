"""CHAT05P02 serial local checks; reuse OPS14 ownership and stopping decisions."""
import dataclasses
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import time
from datetime import datetime, timezone

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/evidence/chat05p02'
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('chat05p02_ops14', MODULE)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
COMMANDS = {
    'leaf': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p02/local.config.mjs'],
    'types': [NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '--project', 'docs/evidence/chat05p02/focused-tsconfig.json', '--pretty', 'false'],
    'wiring': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p02/local.config.mjs', '-t', 'public FlowClient|public client original|actual runtime legacy|blocks new claims|admitted attempt unresolved|retains body envelopes'],
    'concurrency': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p02/local.config.mjs', '-t', 'unqualified multi-attempt'],
    'direct': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p02/direct.config.mjs'],
    'deadline': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p02/direct.config.mjs', '-t', 'uses the original request deadline'],
    'host': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p02/local.config.mjs', 'apps/runner/src/native-activity-body/host-production.test.ts', '-t', 'actual runtime legacy|blocks new claims|admitted attempt unresolved|retains body envelopes'],
}

def now(): return datetime.now(timezone.utc).isoformat()
def free():
    value = os.statvfs(ROOT)
    return value.f_bavail * value.f_frsize

def durable(path, value):
    with path.open('x') as output:
        json.dump(value, output, indent=2); output.write('\n'); output.flush(); os.fsync(output.fileno())

def sample(root, identity):
    current = root.lstat()
    assert stat.S_ISDIR(current.st_mode) and (current.st_dev, current.st_ino) == identity
    files = []; dirs = []; started = time.monotonic(); count = 0
    for directory, children, leaves in os.walk(root, followlinks=False):
        for name in children + leaves:
            count += 1
            assert count <= 4096 and time.monotonic() - started < 1
            path = Path(directory) / name; item = path.lstat()
            assert not stat.S_ISLNK(item.st_mode)
            if stat.S_ISDIR(item.st_mode): dirs.append(str(path.relative_to(root)))
            else:
                assert stat.S_ISREG(item.st_mode) and item.st_nlink == 1
                files.append({'path': str(path.relative_to(root)), 'bytes': item.st_size, 'dev': item.st_dev, 'ino': item.st_ino})
    return {'bytes': sum(item['bytes'] for item in files), 'files': files, 'directories': dirs, 'free': free(), 'sampleOnly': True}

assert len(sys.argv) >= 3 and sys.argv[1].isdigit()
names = sys.argv[2:]; assert all(name in COMMANDS for name in names)
prior = [json.loads(path.read_text()) for path in BASE.glob('local-run-*/result.json')]
used_ms = sum(run['supervisedTotalMs'] for run in prior)
used_raw = sum(item.get('rawBytes', 0) for run in prior for item in run['commands'])
assert used_ms < 180000 and used_raw < 2 * 1024**2
run = BASE / ('local-run-' + sys.argv[1]); run.mkdir(mode=0o700)
record = {'startedAt': now(), 'priorSupervisedMs': used_ms, 'priorRawBytes': used_raw, 'commands': [], 'PG': 0, 'provider': 0, 'browser': 0}
durable(run / 'reservation.json', record)
for name in names:
    before = free(); required = 1024**3 + 18 * 1024**2
    result = {'name': name, 'startedAt': now(), 'freeBefore': before, 'requiredFree': required, 'command': COMMANDS[name]}
    if before < required or used_ms >= 177500 or used_raw >= 2 * 1024**2:
        result['status'] = 'NOT_RUN'; record['commands'].append(result); break
    temp = run / (name + '-tmp'); temp.mkdir(mode=0o700); st = temp.stat(); identity = (st.st_dev, st.st_ino)
    env = {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin', 'HOME': str(temp), 'TMPDIR': str(temp), 'TMP': str(temp), 'TEMP': str(temp), 'FLOW_TEST_CACHE_DIR': str(temp / 'vite'), 'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
    budget = min(30, (180000 - used_ms) / 1000 - 2.5)
    report = ops.supervise(ops.Launch(tuple(COMMANDS[name]), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION), ops.Policy(budget, .5, 2, min(256 * 1024, 2 * 1024**2 - used_raw)))
    used_ms += report.elapsed_ms; raw = len(report.stdout) + len(report.stderr); used_raw += raw
    data = dataclasses.asdict(report); data.pop('stdout'); data.pop('stderr')
    result.update(supervision=data, rawBytes=raw, finishedAt=now(), tmpIdentity={'dev': identity[0], 'ino': identity[1]})
    for stream in ['stdout', 'stderr']:
        with (run / f'{name}.{stream}').open('xb') as output:
            output.write(getattr(report, stream)); output.flush(); os.fsync(output.fileno())
    try:
        final = sample(temp, identity); result['finalSample'] = final
        resource_ok = final['bytes'] <= 16 * 1024**2 and final['free'] >= 1024**3
    except Exception as error:
        result['sampleError'] = type(error).__name__; resource_ok = False
    complete = report.owned_state == 'absent' and all(report.eof.values()) and report.first_failure is None
    result['status'] = 'PASSED' if report.exit_code == 0 and complete and resource_ok else 'FAILED_OR_UNKNOWN'
    durable(run / f'{name}-checkpoint.json', result)
    if complete and resource_ok:
        current = sample(temp, identity); assert current['files'] == final['files'] and current['directories'] == final['directories']
        for item in final['files']: (temp / item['path']).unlink()
        for relative in sorted(final['directories'], key=lambda path: len(Path(path).parts), reverse=True): (temp / relative).rmdir()
        fresh = temp.lstat(); assert (fresh.st_dev, fresh.st_ino) == identity; temp.rmdir(); result['tmpRemoved'] = True
    else: result['tmpRetained'] = True
    record['commands'].append(result)
    if result['status'] != 'PASSED': break
record.update(finishedAt=now(), supervisedTotalMs=used_ms-record['priorSupervisedMs'], cumulativeSupervisedMs=used_ms, cumulativeRawBytes=used_raw, observationLimit='Final metadata sample only, not instantaneous disk peak; pure cases allocate bounded in-memory buffers. OPS14 bounds actual processes and raw.')
durable(run / 'result.json', record)
print(json.dumps({'run': str(run), 'commands': [{'name': item['name'], 'status': item['status'], 'exit': item.get('supervision', {}).get('exit_code')} for item in record['commands']], 'cumulativeMs': used_ms, 'cumulativeRawBytes': used_raw}))
