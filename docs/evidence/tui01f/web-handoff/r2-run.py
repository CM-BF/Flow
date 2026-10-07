"""Fixed F04 caller; OPS14 owns its child, original fixture owns detached roles/DB."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
from urllib.parse import urlsplit
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WINDOW = 'flow-tui01f04-20261007-r2'
INPUT = 'r2-inputs.json'
PERMIT = 'r2-permit.json'
OUTER = 'r2-actual-once'
OWN = ['apps/tui/src/task-controls/fixture.ts', 'experiments/tui-web-control-handoff/journey.ts',
       'experiments/tui-web-control-handoff/preview.ts', 'experiments/tui-web-control-handoff/terminal.py']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_pin(pin):
    path = Path(pin['path'])
    info = path.stat()
    assert str(path.resolve()) == pin.get('realpath', str(path)), 'PIN_REALPATH'
    assert not path.is_symlink() and path.is_file(), 'PIN_TYPE'
    data = path.read_bytes()
    assert len(data) == pin['bytes'] and sha(data) == pin['sha256'], 'PIN_BYTES'
    if 'uid' in pin:
        assert info.st_uid == pin['uid'] and info.st_nlink == pin['nlink'], 'PIN_IDENTITY'
    return data


def verify_inputs():
    raw = (HERE / INPUT).read_bytes()
    value = json.loads(raw)
    assert value['windowId'] == WINDOW and value['root'] == str(ROOT), 'INPUT_IDENTITY'
    inherited = [json.loads(read_pin(p)) for p in value['inherit']]
    rows = inherited[0]['backendBindings'] + inherited[1]['bindings']
    for pin in rows + value['own'] + [value[k] for k in ['node', 'supervisor', 'python', 'terminalPython']]:
        read_pin(pin)
    files = [{'path': p, 'sha256': sha((ROOT / p).read_bytes())} for p in OWN]
    identity = {'files': files, 'inputs': [{'path': p['path'], 'sha256': p['sha256']} for p in rows]}
    digest = sha(json.dumps(identity, separators=(',', ':'), ensure_ascii=False).encode())
    assert digest == value['sourceDigest'], 'SOURCE_DIGEST'
    return value, sha(raw), len(rows)


def validate_permit(permit, fixed, input_digest, now, free):
    assert permit['ready'] is True and permit['windowId'] == WINDOW, 'UNSELECTED'
    assert permit['sourceDigest'] == fixed['sourceDigest'] and permit['inputDigest'] == input_digest, 'SOURCE_BINDING'
    assert permit['callerDigest'] == sha(Path(__file__).read_bytes()), 'CALLER_BINDING'
    assert permit['providerCalls'] == 0 and permit['personalOperations'] == 0, 'SCOPE'
    assert permit['logicalId'] == 'TUI01F04-REAL-HANDOFF-R2-ONCE', 'LOGICAL_ID'
    assert datetime.fromisoformat(permit['startBefore'].replace('Z', '+00:00')) > now, 'EXPIRED'
    observed = datetime.fromisoformat(permit['freshObservedAt'].replace('Z', '+00:00'))
    assert 0 <= (now - observed).total_seconds() <= 30, 'FRESH_OBSERVATION'
    assert permit['pgAvailable'] >= 42 and permit['preflightPoolClosed'] is True, 'PG_CAPACITY'
    floor = permit['minimumFreshFreeBytes']
    assert type(floor) is int and floor >= 1024**3 + 128*1024**2 and free >= floor, 'FRESH_SPACE'
    assert permit['actualHolder'] is None, 'HOLDER'
    return floor


def load_ops(pin):
    read_pin(pin)
    spec = importlib.util.spec_from_file_location('tui01f_r2_ops14', pin['path'])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def save(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    assert len(data) <= 512 * 1024, 'RECORD_BOUND'
    with path.open('x', encoding='utf8') as output:
        os.chmod(path, 0o600)
        output.write(data.decode()); output.flush(); os.fsync(output.fileno())


def main(argv):
    assert argv == ['--run-r2-once'], 'EXACT_ARGUMENT'
    fixed, digest, count = verify_inputs()
    permit_path = HERE / PERMIT
    assert permit_path.is_file() and not permit_path.is_symlink() and permit_path.stat().st_size <= 4096, 'PERMIT_FILE'
    permit = json.loads(permit_path.read_bytes())
    space = os.statvfs(ROOT)
    validate_permit(permit, fixed, digest, datetime.now(timezone.utc), space.f_bavail*space.f_frsize)
    assert not os.path.lexists(HERE / 'windows' / (WINDOW+'.json')), 'WINDOW_CONSUMED'
    assert not os.path.lexists(HERE / 'captures' / WINDOW), 'OLD_CAPTURE_CONSUMED'
    admin = os.environ.get('FLOW_TEST_DATABASE_URL', '')
    url = urlsplit(admin)
    assert url.scheme in ('postgres', 'postgresql') and url.hostname in ('127.0.0.1', 'localhost', '::1') and url.path == '/postgres', 'EXPLICIT_LOCAL_ADMIN'
    ops = load_ops(fixed['supervisor'])
    env = {k: os.environ[k] for k in ['HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'] if k in os.environ}
    env.update(PATH='/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', TSX_DISABLE_CACHE='1', FLOW_TEST_DATABASE_URL=admin)
    launch = ops.Launch((fixed['node']['path'], '--import', 'tsx', 'experiments/tui-web-control-handoff/journey.ts', '--run', str(permit_path)), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION)
    policy = ops.Policy(150, .5, 2, 65536)
    ops._validate(launch, policy)
    directory = HERE / OUTER
    directory.mkdir(mode=0o700)  # Existing or symlink namespace is never reused.
    save(directory / 'reservation.json', {'at': datetime.now(timezone.utc).isoformat(), 'window': WINDOW,
        'inputDigest': digest, 'sourceDigest': fixed['sourceDigest'], 'inheritedPins': count,
        'argv': list(launch.argv), 'limits': fixed['limits'], 'outcome': 'UNKNOWN_KEEP'})
    report = ops.supervise(launch, policy)
    value = {**vars(report), 'stdout': report.stdout.decode('utf8', 'replace'), 'stderr': report.stderr.decode('utf8', 'replace')}
    save(directory / 'outer-report.json', value)
    complete = report.exit_code == 0 and report.first_failure is None and report.owned_state == 'absent' and all(report.eof.values())
    summary = {'operatorComplete': complete, 'phaseAndCleanupAuthority': 'original journey/fixture records',
               'detachedResources': 'NOT_INFERRED_FROM_OPERATOR_EXIT', 'retry': False, 'elapsedMs': report.elapsed_ms}
    save(directory / 'disposition.json', summary)
    print(json.dumps(summary))
    return 0 if complete else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'outcome': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)
