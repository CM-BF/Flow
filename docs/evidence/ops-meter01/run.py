"""Own small validation caller. Uses fixed OPS14; never measures a real Web tree."""
from dataclasses import asdict
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'
SUPERVISOR_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
PRODUCT = ROOT / 'tools/owned-resource-measurement'


def durable(path, data):
    with path.open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def main():
    assert len(sys.argv) >= 2 and re.fullmatch('local-[0-9]{2}', sys.argv[1])
    run = HERE / sys.argv[1]
    assert not run.exists()
    # One finite segment across all iterations, including failures.
    previous = [json.loads(p.read_text()) for p in HERE.glob('local-*/result.json')]
    elapsed = sum(p['child']['elapsed_ms'] for p in previous)
    old_bytes = sum(p.stat().st_size for d in HERE.glob('local-*') if d.is_dir() for p in d.iterdir() if p.is_file())
    assert elapsed < 48_000 and old_bytes < 128 * 1024
    free = shutil.disk_usage(ROOT).free
    assert free >= 1024 ** 3 + 4 * 1024 ** 2 + 256 * 1024
    assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == SUPERVISOR_SHA
    run.mkdir()
    started = time.monotonic()
    scratch = Path(tempfile.mkdtemp(prefix='flow-meter01-', dir=Path(tempfile.gettempdir()).resolve()))
    identity = scratch.lstat()
    source = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size,
               'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
              for p in [PRODUCT / 'measure.py', PRODUCT / 'measure.test.py', Path(__file__)]]
    reservation = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                   'source': source, 'scratch': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino,
                   'freeBytes': free, 'segmentWorkMs': 60000, 'priorWorkMs': elapsed,
                   'tmpCapBytes': 4 * 1024 ** 2, 'rawCapBytes': 256 * 1024,
                   'previousRawBytes': old_bytes, 'provider': 0, 'PG': 0, 'browser': 0}
    durable(run / 'reservation.json', (json.dumps(reservation, indent=2) + '\n').encode())
    spec = importlib.util.spec_from_file_location('ops14_measure_validation', SUPERVISOR)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    env = {'PATH': os.environ['PATH'], 'PYTHONDONTWRITEBYTECODE': '1',
           'FLOW_METER_SCRATCH': str(scratch), 'TMPDIR': str(scratch), 'HOME': str(scratch)}
    report = module.supervise(module.Launch(
        (sys.executable, '-B', str(PRODUCT / 'measure.test.py'), *sys.argv[2:]),
        str(ROOT), env, module.Ownership.NEW_CHILD_SESSION),
        module.Policy(10, 0.2, 1, 64 * 1024))
    durable(run / 'stdout.txt', report.stdout)
    durable(run / 'stderr.txt', report.stderr)
    child = asdict(report)
    child.pop('stdout'); child.pop('stderr')
    selected = re.search(rb'Ran (\d+) tests?', report.stderr)
    result = {'child': child, 'selected': int(selected[1]) if selected else 0,
              'testsPassed': report.exit_code == 0 and selected is not None,
              'callerElapsedMsBeforeCleanup': round((time.monotonic() - started) * 1000),
              'scratchCleanup': 'pending', 'peakBytes': 'NOT_MEASURED; finite synthetic fixture construction only'}
    durable(run / 'result.json', (json.dumps(result, indent=2) + '\n').encode())
    # Persist result before cleanup. Remove only this empty, identity-pinned directory.
    current = scratch.lstat()
    absent = report.owned_state == 'absent' and all(report.eof.values())
    cleanup = 'KEEP'
    if absent and (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino) and not list(scratch.iterdir()):
        scratch.rmdir()
        cleanup = 'removed'
    receipt = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scratch': str(scratch),
               'state': cleanup, 'ownedState': report.owned_state, 'eof': report.eof,
               'elapsedMs': round((time.monotonic() - started) * 1000)}
    durable(run / 'cleanup.json', (json.dumps(receipt, indent=2) + '\n').encode())
    print(json.dumps({'run': str(run), 'selected': result['selected'], 'exit': report.exit_code,
                      'ownedState': report.owned_state, 'cleanup': cleanup, 'elapsedMs': receipt['elapsedMs']}))
    return 0 if result['testsPassed'] and absent and cleanup == 'removed' else 1


if __name__ == '__main__':
    sys.exit(main())
