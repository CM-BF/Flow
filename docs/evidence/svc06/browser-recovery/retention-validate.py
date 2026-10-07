"""Bounded direct retention consumers; OPS14 owns process deadlines and capture."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from datetime import datetime, timezone

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]

def main(argv):
    if len(argv) != 1 or argv[0] not in ('01', '02', '03'):
        raise ValueError('EXACT_LOCAL_ROUND_REQUIRED')
    output = HERE / ('retention-local-' + argv[0] + '.json')
    consumed = [json.loads(path.read_bytes()) for path in HERE.glob('retention-local-*.json')]
    remaining = 60 - sum(item['report']['elapsed_ms'] / 1000 for item in consumed)
    if remaining <= 3:
        raise ValueError('LOCAL_TIME_EXHAUSTED')
    free = shutil.disk_usage(HERE).free
    if free < 11623661568:
        raise ValueError('SPACE_GATE')
    binding = json.loads((HERE / 'build-inputs.json').read_bytes())['supervisor']
    module = Path(binding['path'])
    assert str(module.resolve()) == binding['realpath']
    assert hashlib.sha256(module.read_bytes()).hexdigest() == binding['sha256']
    spec = importlib.util.spec_from_file_location('svc06b_retention_ops', module)
    ops = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = ops
    spec.loader.exec_module(ops)
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    scratch = Path(tempfile.mkdtemp(prefix='flow-svc06b-retention-', dir='/private/tmp')).resolve()
    identity = scratch.stat()
    command = ('/opt/homebrew/opt/node@24/bin/node', '--test', '--test-concurrency=1',
               '--test-name-pattern=^retention ', 'tools/personal-preview/backend-release/artifact.test.mjs')
    record = {'startedAt': datetime.now(timezone.utc).isoformat(), 'argv': command,
              'freshFreeBytes': free, 'timeRemainingSeconds': remaining,
              'scratch': {'path': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino},
              'source': {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in (
                  'tools/personal-preview/backend-release/files.mjs',
                  'tools/personal-preview/backend-release/index.mjs',
                  'tools/personal-preview/backend-release/artifact.test.mjs')},
              'providerCalls': 0, 'pgCalls': 0, 'buildCalls': 0, 'personalIO': 0}
    report = ops.supervise(ops.Launch(command, str(ROOT), {
        'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'TMPDIR': str(scratch),
        'HOME': str(scratch), 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'
    }, ops.Ownership.NEW_CHILD_SESSION), ops.Policy(min(30, remaining - 2.5), .5, 2, 1024 * 1024))
    record['report'] = dict(vars(report))
    for key in ('stdout', 'stderr'):
        record['report'][key] = getattr(report, key).decode('utf8', 'replace')
    record['remaining'] = sorted(path.name for path in scratch.iterdir())
    now = scratch.stat()
    record['cleanup'] = 'KEEP'
    if (now.st_dev, now.st_ino) == (identity.st_dev, identity.st_ino) and not record['remaining'] and report.owned_state == 'absent':
        scratch.rmdir()
        record['cleanup'] = 'REMOVED_SAME_EMPTY_DIRECTORY'
    record['finishedAt'] = datetime.now(timezone.utc).isoformat()
    with os.fdopen(fd, 'w') as stream:
        json.dump(record, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    print(json.dumps({'output': str(output), 'exit': report.exit_code, 'elapsedMs': report.elapsed_ms,
                      'group': report.owned_state, 'eof': report.eof, 'cleanup': record['cleanup']}))
    return 0 if report.exit_code == 0 and report.first_failure is None and report.owned_state == 'absent' and all(report.eof.values()) else 1

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
