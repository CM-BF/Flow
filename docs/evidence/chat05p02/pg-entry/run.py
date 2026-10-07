"""Two production PG cases using the existing OPS14 supervisor, not a second runner."""
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
START = time.monotonic()
ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'docs/evidence/chat05p02/pg-entry'
assert sys.argv[1:] in ([], ['repair-02'], ['repair-03']), 'Only the fixed original, repair-02, or repair-03 entry is supported'
REPAIR = bool(sys.argv[1:])
REPAIR_THREE = sys.argv[1:] == ['repair-03']
INPUT_BASE = BASE.parent / 'pg-repair-03' if REPAIR_THREE else BASE.parent / 'pg-repair' if REPAIR else BASE
RUN = BASE.parent / ('pg-run-03' if REPAIR_THREE else 'pg-run-02' if REPAIR else 'pg-run-01')
INPUT = json.loads((INPUT_BASE / 'inputs.json').read_text())


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def free():
    info = os.statvfs(ROOT)
    return info.f_bavail * info.f_frsize


def durable(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    assert len(data) <= 1024 * 1024
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())
    parent = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(parent)
    finally:
        os.close(parent)


def fixed_inputs():
    for item in INPUT['files']:
        path = Path(item['path'])
        if not path.is_absolute():
            path = ROOT / path
        assert path.resolve() == Path(item['realpath'])
        assert path.stat().st_size == item['bytes'] and digest(path) == item['sha256'], str(path)
    for link in INPUT['aliases']:
        path = Path(link['path'])
        assert path.is_symlink() and os.readlink(path) == link['readlink'] and str(path.resolve()) == link['realpath']
    assert time.monotonic() - START < 10, 'Input validation exceeded its preparation budget'


def final_temporary(identity):
    root = RUN / 'tmp'
    current = root.lstat()
    assert stat.S_ISDIR(current.st_mode) and (current.st_dev, current.st_ino) == identity
    result = {'bytes': 0, 'files': [], 'directories': []}
    deadline = time.monotonic() + .5
    count = 0
    for folder, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            count += 1
            assert count <= 1024 and time.monotonic() < deadline
            path = Path(folder) / name
            item = path.lstat()
            assert not stat.S_ISLNK(item.st_mode)
            if stat.S_ISREG(item.st_mode):
                assert item.st_nlink == 1
                result['bytes'] += item.st_size
                result['files'].append(str(path.relative_to(root)))
            else:
                assert stat.S_ISDIR(item.st_mode)
                result['directories'].append(str(path.relative_to(root)))
    return result


assert os.environ.get('FLOW_CHAT05P02_PG_WINDOW') == 'authorized', 'No shared PG window: NOT_RUN'
fixed_inputs()
available = free()
assert available >= INPUT['freshFreeBytes'], 'Fresh resource gate: NOT_RUN'
assert not RUN.exists() and not RUN.is_symlink(), 'Exclusive run already exists: never retry'
os.mkdir(RUN, 0o700)
os.mkdir(RUN / 'tmp', 0o700)
temp = (RUN / 'tmp').lstat()
reservation = {'startedAt': now(), 'source': INPUT['productSource'], 'selected': INPUT['selected'],
               'freshFreeBytes': available, 'budget': INPUT['budget'], 'PG': 1, 'provider': 0,
               'tmp': {'dev': temp.st_dev, 'ino': temp.st_ino}, 'inputsSha256': digest(INPUT_BASE / 'inputs.json')}
durable(RUN / 'reservation.json', reservation)
module = Path(INPUT['supervisor'])
spec = importlib.util.spec_from_file_location('chat05_pg_ops14', module)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
env = {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin', 'HOME': str(RUN / 'tmp'),
       'TMPDIR': str(RUN / 'tmp'), 'TMP': str(RUN / 'tmp'), 'TEMP': str(RUN / 'tmp'),
       'FLOW_TEST_CACHE_DIR': str(RUN / 'tmp/cache'), 'TSX_DISABLE_CACHE': '1',
       'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1',
       'FLOW_CHAT05P02_PG_WINDOW': 'authorized', 'FLOW_CHAT05P02_PG_ALLOWANCE_BYTES': str(96 * 1024**2),
       'FLOW_CHAT05P02_PG_EVIDENCE': str((RUN / 'fixture.jsonl').relative_to(ROOT))}
command = (INPUT['node'], str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config',
           str(INPUT_BASE / ('pg.config.mjs' if REPAIR else 'config.mjs')), 'apps/server/src/native-activity-body/production.test.ts')
# The entire suite, including its normal afterAll, fits inside the original 90 s.
# Timeout stops only this owned session. It does not imply database cleanup.
remaining = min(90, 100 - (time.monotonic() - START))
assert remaining > 0
report = ops.supervise(ops.Launch(command, str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION),
                       ops.Policy(remaining, .5, 2, 1024 * 1024))
result = {'endedAt': now(), 'supervision': {k: v for k, v in vars(report).items() if k not in ['stdout', 'stderr']},
          'callerElapsedMs': round((time.monotonic() - START) * 1000), 'rawBytes': len(report.stdout) + len(report.stderr),
          'primaryFailure': report.first_failure, 'observationErrors': [], 'status': 'UNKNOWN_RETAIN',
          'databaseAndFixtureCleanup': 'UNKNOWN', 'tmpPolicy': 'KEEP cache/evidence; fixture removes only its own identified directory'}
# Persistence happens only after OPS14 has completed its stop/reap decision.
durable(RUN / 'stdout.txt', report.stdout)
durable(RUN / 'stderr.txt', report.stderr)
try:
    assert report.owned_state == 'absent' and all(report.eof.values()), 'Owned group/EOF unknown'
    result['finalTmp'] = final_temporary((temp.st_dev, temp.st_ino))
    result['freeAfter'] = free()
    for filename, limit in [('fixture.jsonl', 256 * 1024), ('vitest.json', 512 * 1024)]:
        path = RUN / filename
        item = path.lstat()
        assert stat.S_ISREG(item.st_mode) and item.st_nlink == 1 and item.st_size <= limit
    lines = (RUN / 'fixture.jsonl').read_text().splitlines()
    checkpoints = [json.loads(line) for line in lines]
    assert len({item['database'] for item in checkpoints}) == 1
    facts = checkpoints[-1]; result['fixtureFinal'] = facts
    assert facts['productionFactoryOnly'] is True
    assert facts['phase'] == 'cleaned' and facts['databaseDropped'] and facts['remaining'] == []
    assert facts['directoryRemoved'] and facts['listenerClosed'] and facts['adminClosed'] and facts['cleanupErrors'] == []
    result['databaseAndFixtureCleanup'] = 'CONFIRMED'
    tests = json.loads((RUN / 'vitest.json').read_text())
    result['selection'] = {key: tests.get(key) for key in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'success']}
    assert tests['numTotalTests'] == 2 and tests['numPassedTests'] == 2 and tests['numPendingTests'] == 0 and tests['success']
    raw = sum(p.stat().st_size for p in RUN.iterdir() if p.is_file())
    result['persistedRawBytesBeforeResult'] = raw
    assert raw <= 2 * 1024**2 - 64 * 1024 and result['finalTmp']['bytes'] <= 16 * 1024**2
    assert result['freeAfter'] >= 1024**3 and facts['minObservedFreeBytes'] >= 1024**3
    assert report.exit_code == 0 and report.first_failure is None
    result['status'] = 'PASSED'
except Exception as error:
    result['observationErrors'].append({'type': type(error).__name__})
# A failed suite and a cleanup observation remain separate; none is overwritten.
durable(RUN / 'result.json', result)
print(json.dumps({'status': result['status'], 'exit': report.exit_code, 'group': report.owned_state,
                  'cleanup': result['databaseAndFixtureCleanup'], 'result': str(RUN / 'result.json')}))
sys.exit(0 if result['status'] == 'PASSED' else 1)
