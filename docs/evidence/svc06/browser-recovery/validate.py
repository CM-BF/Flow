"""One bounded local record for the reused entry seam; no build or service execution."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
from datetime import datetime, timezone

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
started = time.monotonic()
record = {'startedAt': datetime.now(timezone.utc).isoformat(), 'reports': [], 'providerCalls': 0, 'pgCalls': 0, 'buildCalls': 0}
out = HERE / 'validation-01.json'
fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
assert shutil.disk_usage(HERE).free >= int(2.5 * 1024 ** 3)
delta = json.loads((HERE / 'build-inputs.json').read_bytes())
module = Path(delta['supervisor']['path'])
assert hashlib.sha256(module.read_bytes()).hexdigest() == delta['supervisor']['sha256']
spec = importlib.util.spec_from_file_location('svc06b_local_ops', module)
ops = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = ops
spec.loader.exec_module(ops)
scratch = Path(tempfile.mkdtemp(prefix='flow-svc06b-local-', dir='/private/tmp')).resolve()
identity = scratch.stat()
record['scratch'] = {'path': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino}
try:
    ast.parse((HERE / 'build-supervise.py').read_text())
    command = ('/opt/homebrew/opt/node@24/bin/node', '--test', str(HERE / 'build-entry.test.mjs'))
    report = ops.supervise(ops.Launch(command, str(HERE.parents[3]),
        {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'TMPDIR': str(scratch), 'HOME': str(scratch),
         'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}, ops.Ownership.NEW_CHILD_SESSION),
        ops.Policy(30, .5, 2, 64 * 1024))
    result = dict(vars(report))
    for key in ('stdout', 'stderr'):
        result[key] = getattr(report, key).decode('utf8', 'replace')
    record['reports'].append(result)
    record['passed'] = report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values())
    now = scratch.stat()
    record['remaining'] = sorted(p.name for p in scratch.iterdir())
    if (now.st_dev, now.st_ino) == (identity.st_dev, identity.st_ino) and not record['remaining'] and report.owned_state == 'absent':
        scratch.rmdir()
        record['cleanup'] = 'REMOVED_SAME_EMPTY_DIRECTORY'
    else:
        record['cleanup'] = 'KEEP'
finally:
    record['finishedAt'] = datetime.now(timezone.utc).isoformat()
    record['elapsedMs'] = round((time.monotonic() - started) * 1000)
    with os.fdopen(fd, 'w') as stream:
        json.dump(record, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
print(json.dumps({'output': str(out), 'passed': record.get('passed'), 'cleanup': record.get('cleanup'), 'elapsedMs': record['elapsedMs']}))
raise SystemExit(0 if record.get('passed') else 1)
