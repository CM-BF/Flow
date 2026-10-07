"""Fixed four-stage SVC08 caller. Replacement supervises the CLI PID itself, never its detached Web group."""
import hashlib
import datetime
import importlib.util
import json
import os
import stat
import sys
import uuid
from pathlib import Path
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
phase = sys.argv[1] if len(sys.argv) == 2 else ''
assert phase in ('migrate', 'request', 'replace', 'post')
inputs = json.loads((BASE / 'inputs.json').read_text())
for item in json.loads((BASE / 'caller-manifest.json').read_text())['sourceBindings']:
    raw = (BASE / item['path']).read_bytes()
    assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
def runtime_bytes(item, path):
    for key in ('uid', 'nlink', 'bytes'):
        assert type(item.get(key)) is int and item[key] >= 0, 'RUNTIME_PIN_REQUIRED'
    for key in ('dev', 'ino'):
        assert isinstance(item.get(key), str) and item[key].isdecimal() and str(int(item[key])) == item[key], 'EXACT_DECIMAL_IDENTITY_REQUIRED'
    assert item['nlink'] >= 1 and Path(item['realpath']).is_absolute()
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        assert stat.S_ISREG(before.st_mode) and before.st_size == item['bytes']
        for key in ('uid', 'nlink', 'dev', 'ino'): assert getattr(before, 'st_' + key) == int(item[key])
        chunks, count = [], 0
        while count <= item['bytes']:
            chunk = os.read(fd, min(65536, item['bytes'] + 1 - count))
            if not chunk: break
            chunks.append(chunk); count += len(chunk)
        after = os.fstat(fd)
        for key in ('st_dev', 'st_ino', 'st_uid', 'st_nlink', 'st_size', 'st_mtime_ns'): assert getattr(before, key) == getattr(after, key)
    finally: os.close(fd)
    raw = b''.join(chunks)
    assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
    assert str(path.resolve()) == item['realpath']
    return raw
# The CLI phase gets the same explicit readonly identity pins as the Node caller, without weakening private files.
for item in inputs['rootToolClosure'] + inputs['runtimeTools'] + inputs['resolvedRootEntries'] + inputs['reusedHelpers']:
    path = Path(item['path']) if Path(item['path']).is_absolute() else Path(inputs['repository']) / item['path']
    runtime_bytes(item, path)
module = inputs['supervisor']
runtime_bytes(module, Path(module['path']))
spec = importlib.util.spec_from_file_location('svc08_adoption_ops14', module['path'])
supervision = importlib.util.module_from_spec(spec); sys.modules[spec.name] = supervision; spec.loader.exec_module(supervision)
run = Path(inputs['executionDirectory'])
def durable(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)
def complete(path):
    info = path.lstat(); assert stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and info.st_nlink == 1 and info.st_size < 2 * 1024**2
    value = json.loads(path.read_text())
    assert value['exit_code'] == 0 and value['first_failure'] is None and value['owned_state'] == 'absent' and all(value['eof'].values())
resume = inputs.get('completedMigration')
assert not (resume and phase == 'migrate'), 'COMPLETED_MIGRATION_MUST_NOT_REPLAY'
if resume: assert str(run) != resume['directory']
if phase == 'migrate' or phase == 'request' and resume:
    os.mkdir(run, 0o700)
    st = run.lstat()
    durable(run / 'reservation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'identity': {'dev': st.st_dev, 'ino': st.st_ino}, 'operationId': str(uuid.uuid4()), 'inputSha256': hashlib.sha256((BASE / 'inputs.json').read_bytes()).hexdigest(), 'personalAction': 'not-started', 'completedMigrationDirectory': resume['directory'] if resume else None})
else:
    prior = {'request': 'migrate', 'replace': 'request', 'post': 'replace'}[phase]
    complete(run / (prior + '-outer.json'))
reservation = json.loads((run / 'reservation.json').read_text())
st = run.lstat()
assert stat.S_ISDIR(st.st_mode) and not stat.S_ISLNK(st.st_mode) and st.st_uid == os.getuid() and stat.S_IMODE(st.st_mode) == 0o700
assert {'dev': st.st_dev, 'ino': st.st_ino} == reservation['identity']
assert reservation['inputSha256'] == hashlib.sha256((BASE / 'inputs.json').read_bytes()).hexdigest()
fd = os.open(run / (phase + '-outer.json'), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
node = inputs['node']
env = {key: os.environ[key] for key in ('HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG') if key in os.environ}
env.update({'PATH': str(Path(node).parent) + ':/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'})
if phase == 'replace':
    intent = json.loads((run / 'replace-intent.json').read_text())
    import datetime
    age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(intent['at'].replace('Z', '+00:00'))).total_seconds()
    assert 0 <= age <= 60, 'REQUEST_FRESHNESS_EXPIRED_NO_REBASE'
    free = os.statvfs(inputs['installationDirectory']); assert free.f_bavail * free.f_frsize >= inputs['proposedBudget']['freshBytes']
    request = run / 'request.json'
    info = request.lstat(); assert stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1
    command = (node, str(Path(inputs['repository']) / 'tools/personal-preview/cli.mjs'), 'web', 'replace-host', '--directory', inputs['installationDirectory'], '--request', str(request))
    ownership, policy = supervision.Ownership.CHILD_PID_ONLY, supervision.Policy(28, 0, 2, 128 * 1024)
else:
    command = (node, str(BASE / 'caller.mjs'), phase, str(run))
    ownership = supervision.Ownership.NEW_CHILD_SESSION
    policy = supervision.Policy(120 if phase == 'migrate' else 20, .5, 2, 128 * 1024)
# All side-effecting work is supervised. Parent persistence starts only after stop/reap; it cannot defer stopping.
report = supervision.supervise(supervision.Launch(command, inputs['repository'], env, ownership), policy)
result = dict(vars(report))
for key in ('stdout', 'stderr'): result[key] = getattr(report, key).decode('utf8', 'replace')
with os.fdopen(fd, 'w') as stream:
    json.dump(result, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
fd = os.open(run, os.O_RDONLY)
try: os.fsync(fd)
finally: os.close(fd)
print(json.dumps({'phase': phase, 'exit': report.exit_code, 'owned': report.owned_state, 'eof': report.eof, 'failure': report.first_failure, 'elapsedMs': report.elapsed_ms}))
raise SystemExit(0 if report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values()) else 1)
