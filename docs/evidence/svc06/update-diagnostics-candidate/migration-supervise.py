"""Only the fixed migration. The original OPS14 owns one new session including clone/rename children."""
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
assert sys.argv[1:] == ['--execute-fixed-import']
inputs = json.loads((BASE / 'migration-inputs.json').read_bytes())
manifest = json.loads((BASE / 'migration-manifest.json').read_bytes())
for item in manifest['sourceBindings']:
    raw = (BASE / item['path']).read_bytes()
    assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
# These imports are evaluated before the Node main; bind them and the supervisor before spawning.
for item in inputs['runtimePins']:
    path = Path(item['path']); info = path.lstat()
    assert path.is_file() and not path.is_symlink() and str(path.resolve()) == item['realpath']
    assert (str(info.st_dev), str(info.st_ino), info.st_uid, info.st_nlink, info.st_size) == (item['dev'], item['ino'], item['uid'], item['nlink'], item['bytes'])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
module = inputs['supervisor']
spec = importlib.util.spec_from_file_location('svc06_migration_ops14', module['path'])
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
assert not Path(inputs['runDirectory']).exists() and not Path(inputs['runDirectory']).is_symlink()
fd = os.open(inputs['outerPath'], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
budget = inputs['budget']
# No nested detached copy groups: all subprocesses inherit this owned session.
report = ops.supervise(ops.Launch((inputs['node'], str(BASE / 'migration-adapter.mjs'), '--execute-fixed-import'), inputs['repository'],
    {'PATH': str(Path(inputs['node']).parent) + ':/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}, ops.Ownership.NEW_CHILD_SESSION),
    ops.Policy(budget['workSeconds'], budget['termSeconds'], budget['reapSeconds'], budget['outputBytes']))
result = dict(vars(report))
for key in ('stdout', 'stderr'): result[key] = getattr(report, key).decode('utf8', 'replace')
# Stop/reap/EOF decisions are complete before persistence. An incomplete file is unknown, never reusable.
with os.fdopen(fd, 'w') as stream:
    json.dump(result, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
parent = os.open(str(Path(inputs['outerPath']).parent), os.O_RDONLY)
try: os.fsync(parent)
finally: os.close(parent)
complete = report.exit_code == 0 and report.first_failure is None and report.owned_state == 'absent' and all(report.eof.values())
print(json.dumps({'phase':'migrate','complete':complete,'elapsedMs':report.elapsed_ms,'owned':report.owned_state,'eof':report.eof,'failure':report.first_failure}))
raise SystemExit(0 if complete else 1)
