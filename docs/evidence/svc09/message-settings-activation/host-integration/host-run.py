"""One fixed host fixture. OPS14 owns each child; this caller owns only resource admission/records."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import time
from datetime import datetime, timezone
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent

def utc():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def pin(value):
    path = Path(value['path'])
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and not path.is_symlink()
    assert str(path.resolve()) == value['realpath']
    data = path.read_bytes()
    assert len(data) == value['bytes'] and hashlib.sha256(data).hexdigest() == value['sha256']
    return data

def save(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    assert len(data) <= 512 * 1024
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)

def report_value(report):
    value = dict(vars(report))
    for key in ('stdout', 'stderr'):
        value[key] = value[key].decode('utf8', 'replace')
    return value

def terminated(report):
    return report.owned_state == 'absent' and all(report.eof.values())

def work_environment(directory):
    # The existing process owner resolves the macOS listener tool by name.
    return {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin', 'HOME': str(directory / 'home'),
        'TMPDIR': str(directory / 'tmp'), 'CLAUDE_CONFIG_DIR': str(directory / 'home'),
        'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1', 'NODE_DISABLE_COMPILE_CACHE': '1'}

def attempt_files(argv):
    if argv == ['--execute-default-host-once']:
        return 'actual-default-host-once', 'default-host-preparation.json'
    assert argv in (['--execute-host-once'], ['--execute-host-r2-once'], ['--execute-host-r3-once'], ['--execute-host-r4-once']), 'EXACT_ARGUMENT_REQUIRED'
    if argv == ['--execute-host-r4-once']:
        return 'actual-host-r4-once', 'host-preparation-r4.json'
    if argv == ['--execute-host-r3-once']:
        return 'actual-host-r3-once', 'host-preparation-r3.json'
    if argv == ['--execute-host-r2-once']:
        return 'actual-host-r2-once', 'host-preparation-r2.json'
    return 'actual-host-once', 'host-preparation.json'

def preparation_bindings(source, read_pin=pin):
    if source.get('purpose') == 'SVC09A_DEFAULT_THREE_ROLE_START_STOP':
        inherited = source['inherits']
        assert inherited['path'] == str(HERE / 'host-preparation-r4.json'), 'FIXED_PREPARATION_REQUIRED'
        assert inherited['sha256'] == 'd38a5bfd4c211c24b34cb170adc4256a4207d2f0bfff1456e274337ce0915ae2'
        previous = preparation_bindings(json.loads(read_pin(inherited)), read_pin)
        replacements = {value['path']: value for value in source['bindings']}
        old = {value['path'] for value in previous}
        additions = {str(HERE / name) for name in ('default-host.mjs', 'controller-loader.mjs', 'controller-driver-inputs.json')}
        assert len(replacements) == len(source['bindings']) and set(replacements) <= old | additions, 'REPLACEMENT_PIN_SET_INVALID'
        assert additions <= set(replacements), 'DEFAULT_DRIVER_PINS_REQUIRED'
        return [replacements.get(value['path'], value) for value in previous] + [replacements[path] for path in sorted(additions)]
    if 'inherits' not in source:
        return source['bindings']
    inherited = source['inherits']
    assert inherited['path'] == str(HERE / 'host-preparation-r3.json'), 'FIXED_PREPARATION_REQUIRED'
    assert inherited['sha256'] == 'd17e168f280f7cb2f18ba57347fcdb16895336063b774b9191ea7545607e7b8c'
    previous = json.loads(read_pin(inherited))['bindings']
    replacements = {value['path']: value for value in source['bindings']}
    previous_paths = {value['path'] for value in previous}
    assert len(previous_paths) == len(previous) == 19, 'INHERITED_PIN_SET_INVALID'
    assert len(replacements) == len(source['bindings']) and set(replacements) <= previous_paths, 'REPLACEMENT_PIN_SET_INVALID'
    return [replacements.get(value['path'], value) for value in previous]

def work_and_cleanup(child, node, namespace, directory, result, write=save, purpose=None):
    assert purpose in (None, 'SVC09A_DEFAULT_THREE_ROLE_START_STOP'), 'HOST_PURPOSE_MISMATCH'
    work_entry = 'default-host.mjs' if purpose else 'host-entry.mjs'
    cleanup_entry = 'default-host.mjs' if purpose else 'host-cleanup.mjs'
    work = child([*node, str(HERE / work_entry), '--work-once', str(directory / 'input.json')], 180, 32, 131072)
    result['work'] = {'exit': work.exit_code, 'ownedState': work.owned_state, 'eof': work.eof, 'firstFailure': work.first_failure}
    result['persistenceFailures'] = []
    try:
        write(namespace / 'work-outer.json', report_value(work))
        write(directory / 'records/work-outer.json', {key: report_value(work)[key]
             for key in ('pid', 'ownership', 'exit_code', 'owned_state', 'eof', 'first_failure')})
    except Exception as error:
        result['persistenceFailures'].append({'phase': 'work-record', 'type': type(error).__name__})
    # Cleanup gets only this exact installation and original work disposition, including unknown.
    # A failed work record must not skip service stop; missing disposition refuses DROP.
    cleanup = child([*node, str(HERE / cleanup_entry), '--cleanup-once', str(directory / 'input.json')], 30, 2, 131072)
    write(namespace / 'cleanup-outer.json', report_value(cleanup))
    result['cleanup'] = {'exit': cleanup.exit_code, 'ownedState': cleanup.owned_state, 'eof': cleanup.eof, 'firstFailure': cleanup.first_failure}
    result['complete'] = not result['persistenceFailures'] and work.exit_code == 0 and not work.first_failure and terminated(work) and cleanup.exit_code == 0 and not cleanup.first_failure and terminated(cleanup)
    return work, cleanup

def main(argv):
    namespace_name, preparation_name = attempt_files(argv)
    deadline = time.monotonic() + 215
    fixed = json.loads((HERE / 'host-inputs.json').read_bytes())
    # Final static source manifest is sealed after the bounded preparation checks.
    source = json.loads((HERE / preparation_name).read_bytes())
    purpose = 'SVC09A_DEFAULT_THREE_ROLE_START_STOP' if argv == ['--execute-default-host-once'] else None
    assert source.get('purpose') == purpose, 'HOST_PURPOSE_MISMATCH'
    for value in preparation_bindings(source) + fixed['bindings']:
        pin(value)
    assert fixed['format'] == 1 and fixed['providerCalls'] == 0
    source_root = Path(fixed['sourceDirectory']); info = source_root.lstat()
    assert stat.S_ISDIR(info.st_mode) and not source_root.is_symlink() and info.st_uid == os.getuid()
    assert {'dev': str(info.st_dev), 'ino': str(info.st_ino)} == fixed['sourceIdentity']
    namespace = HERE / namespace_name
    assert not namespace.exists(), 'ONCE_NAMESPACE_EXISTS'
    assert os.environ.get('FLOW_SVC09A_ADMIN_URL'), 'EXPLICIT_LOCAL_ADMIN_REQUIRED'
    free = min(shutil.disk_usage(HERE).free, shutil.disk_usage('/private/tmp').free)
    assert free >= fixed['minimumFreshFloorBytes']
    module = fixed['supervisor']
    spec = importlib.util.spec_from_file_location('svc09a_host_ops14', module['path'])
    ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
    namespace.mkdir(mode=0o700)
    save(namespace / 'reservation.json', {'at': utc(), 'freeBytes': free, 'minimumFreshFloorBytes': fixed['minimumFreshFloorBytes'],
        'sourceHead': fixed['sourceHead'], 'artifact': fixed['artifact'], 'limits': fixed['limits'], 'providerCalls': 0})
    directory = Path(tempfile.mkdtemp(prefix='flow-svc09a-host-', dir='/private/tmp')); directory.chmod(0o700)
    identity = directory.lstat()
    for name in ('home', 'tmp', 'records', 'backend-artifacts'):
        (directory / name).mkdir(mode=0o700)
    value = {**fixed, 'purpose': purpose, 'directory': str(directory), 'records': str(directory / 'records'),
        'directoryIdentity': {'dev': str(identity.st_dev), 'ino': str(identity.st_ino)}}
    save(directory / 'input.json', value)
    save(namespace / 'owned-root.json', {'directory': str(directory), 'identity': value['directoryIdentity'], 'retention': 'KEEP'})
    env = work_environment(directory)
    def child(argv, seconds, reserve, output_bytes):
        available = min(seconds, deadline - time.monotonic() - reserve - 2.5)
        assert available > 0, 'NO_CHILD_TIME_REMAINING'
        return ops.supervise(ops.Launch(tuple(argv), str(HERE), env, ops.Ownership.NEW_CHILD_SESSION),
            ops.Policy(available, .5, 2, output_bytes))
    clone = child([fixed['python']['path'], fixed['clone']['path'], str(directory / 'input.json')], 20, 37, 16384)
    save(namespace / 'clone-outer.json', report_value(clone))
    result = {'at': utc(), 'purpose': purpose, 'work': 'NOT_RUN', 'cleanup': 'NOT_RUN', 'directory': str(directory), 'retention': 'KEEP', 'providerCalls': 0}
    if clone.exit_code == 0 and not clone.first_failure and terminated(clone):
        root = directory / 'backend-artifacts' / fixed['artifact']['artifactId'] / 'root'
        loader = Path(fixed['tsxRelative'])
        assert not loader.is_absolute() and '..' not in loader.parts
        node = [fixed['node']['path'], '--import', str(root / loader)]
        env['FLOW_SVC09A_ADMIN_URL'] = os.environ['FLOW_SVC09A_ADMIN_URL']
        work, cleanup = work_and_cleanup(child, node, namespace, directory, result, purpose=purpose)
        if terminated(work) and terminated(cleanup):
            # Archive only checkpoint material; never config, token, environment or diagnostic bodies.
            names = sorted((directory / 'records').iterdir()); assert len(names) <= 160
            total = sum(path.lstat().st_size for path in names); assert total <= 1024 * 1024
            archive = namespace / 'records'; archive.mkdir(mode=0o700)
            for path in names:
                before = path.lstat(); assert stat.S_ISREG(before.st_mode) and before.st_uid == os.getuid() and before.st_nlink == 1
                assert path.suffix == '.json' and before.st_size <= 512 * 1024
                data = path.read_bytes(); after = path.lstat()
                assert (before.st_dev, before.st_ino, before.st_mtime_ns, before.st_size) == (after.st_dev, after.st_ino, after.st_mtime_ns, after.st_size)
                # Preserve exact bytes; no summary reconstruction.
                fd = os.open(archive / path.name, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                with os.fdopen(fd, 'wb') as stream:
                    stream.write(data); stream.flush(); os.fsync(stream.fileno())
    result['finishedAt'] = utc(); save(namespace / 'result.json', result)
    print(json.dumps(result)); return 0 if result.get('complete') else 1

if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        # Exception text may contain a private connection string; retain only structural failure.
        print(json.dumps({'errorType': type(error).__name__, 'disposition': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)
