"""One fixed public auth status; raw native output remains memory-only."""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import time

sys.dont_write_bytecode = True

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
RUN = BASE.parent / 'same-runtime-auth-once'
NODE = '/opt/homebrew/opt/node@24/bin/node'
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
METER = SUPERVISOR.parent.parent / 'owned-resource-measurement/measure.py'
PARSER = BASE.parent / 'native-stages/auth-status-once.py'
PINS = [(SUPERVISOR, '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'),
        (METER, '52b92553302378ed44ec38550a02cb15b1d644d274547959fabed344f35e9d08'),
        (PARSER, '292fbba9bee04081c5dd68e1a8e5edf5748f0398eb658e6add62eb4dc4b32bf1')]


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(65536), b''):
            h.update(data)
    return h.hexdigest()


def load(name, path, expected):
    if sha(path) != expected:
        raise ValueError('FIXED_MODULE_MISMATCH')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def durable(name, record):
    data = (json.dumps(record, indent=2) + '\n').encode()
    current = sum(p.stat().st_size for p in RUN.iterdir() if p.is_file())
    if len(data) + current > 65536:
        raise ValueError('SAFE_RECORD_LIMIT')
    with (RUN / name).open('xb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(RUN, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def facts(report):
    return {key: getattr(report, key) for key in ('pid', 'ownership', 'exit_code', 'elapsed_ms',
        'observed_bytes', 'eof', 'first_failure', 'secondary_failures', 'signals', 'owned_state', 'observations')}


def public_environment(prepared):
    environment = prepared['environment']
    expected = {'HOME', 'CLAUDE_CONFIG_DIR', 'TMPDIR', 'CLAUDE_TMPDIR', 'CLAUDE_SECURESTORAGE_CONFIG_DIR',
        'USER', 'PATH', 'LANG', 'DISABLE_AUTOUPDATER', 'DISABLE_TELEMETRY',
        'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_AGENT_SDK_VERSION',
        'CLAUDE_CODE_SDK_READS_SESSION_STATE'}
    if set(environment) != expected or environment['CLAUDE_SECURESTORAGE_CONFIG_DIR'] != '':
        raise ValueError('PUBLIC_ENVIRONMENT_SHAPE')
    for key, value in [('CLAUDE_CODE_ENTRYPOINT', 'sdk-ts'), ('CLAUDE_AGENT_SDK_VERSION', '0.3.290'),
                       ('CLAUDE_CODE_SDK_READS_SESSION_STATE', '1')]:
        if environment[key] != value:
            raise ValueError('SDK_PUBLIC_ENVIRONMENT_MISMATCH')
    return environment


def selfcheck(parser):
    cases = [(b'{"loggedIn":false,"authMethod":"none","email":"synthetic-private"}', {'loggedIn': False, 'authMethod': 'none'}, None),
        (b'{"loggedIn":true,"authMethod":"unexpected-private","apiProvider":"firstParty"}', {'loggedIn': True, 'apiProvider': 'firstParty'}, None),
        (b'{"email":"synthetic-private"}', {}, 'MISSING_PUBLIC_BOOLEAN')]
    for value, expected, reason in cases:
        assert parser.safe_status(value) == (expected, reason)
    print(json.dumps({'selected': len(cases), 'passed': len(cases), 'nativeProcesses': 0, 'queryCalls': 0}))


def main():
    modules = [load('o16_status_' + str(i), p, h) for i, (p, h) in enumerate(PINS)]
    supervisor, meter, parser = modules
    if sys.argv[1:] == ['--selfcheck']:
        return selfcheck(parser)
    if sys.argv[1:] != ['--run']:
        raise ValueError('EXPLICIT_ONCE_ENTRY_REQUIRED')
    preparation_started = time.monotonic()
    free = shutil.disk_usage(ROOT).free
    if RUN.exists() or free < 1073741824 + 8388608 + 65536 + 2147483648:
        raise ValueError('NOT_RUN_NAMESPACE_OR_RESOURCE_GATE')
    # Reuse the actual R3 runtime hashes, not a changed PATH installation.
    runtime = json.loads((BASE.parent / 'native-plan-20261007-r3/preflight.json').read_bytes())['runtime']
    for item in runtime:
        path = Path(item['path'])
        if str(path.resolve()) != item['realpath'] or path.stat().st_size != item['bytes'] or sha(path) != item['sha256']:
            raise ValueError('NOT_RUN_RUNTIME_MISMATCH')
    RUN.mkdir(mode=0o700)
    scratch = Path(tempfile.mkdtemp(prefix='flow-o16-sdk-status-', dir='/private/tmp'))
    original = scratch.lstat()
    durable('reservation.json', {'at': utc(), 'scope': 'one SDK-native2.1.290 public auth status, zero query',
        'callerSHA256': sha(Path(__file__)), 'prepareSHA256': sha(BASE / 'prepare.mjs'),
        'scratch': {'path': str(scratch), 'dev': original.st_dev, 'ino': original.st_ino},
        'freeBytes': free, 'otherHolderHeadroomBytes': 2147483648, 'otherHolderHeadroomScope': 'Conservative reservation for known Mika PG plus other local work, not measured use', 'bounds': {'nativeTotalSeconds': 10, 'memoryOutputBytes': 65536,
        'safeRecordBytes': 65536, 'privateBytes': 8388608, 'entries': 128}, 'state': 'reserved-unknown-never-repeat'})
    preparation = supervisor.supervise(supervisor.Launch((NODE, '--import', 'tsx', str(BASE / 'prepare.mjs')),
        str(ROOT), {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'HOME': str(scratch), 'TMPDIR': str(scratch),
        'TSX_DISABLE_CACHE': '1', 'NODE_DISABLE_COMPILE_CACHE': '1'}, supervisor.Ownership.NEW_CHILD_SESSION),
        supervisor.Policy(10, .25, 1, 65536))
    durable('preparation.json', facts(preparation))
    preparation.stdout = preparation.stderr = b''
    if preparation.exit_code != 0 or preparation.owned_state != 'absent' or not all(preparation.eof.values()):
        durable('result.json', {'state': 'NOT_RUN_PREPARATION_UNKNOWN', 'cleanup': 'KEEP', 'queryCalls': 0})
        return
    prepared = json.loads((RUN / 'prepared.json').read_bytes())
    environment = public_environment(prepared)
    native = Path(prepared['binding']['runtime'][2]['path'])
    native_started = time.monotonic()
    durable('native-reservation.json', {'at': utc(), 'argv': [str(native), 'auth', 'status', '--json'],
        'nativeSHA256': prepared['binding']['runtime'][2]['sha256'], 'environmentKeys': sorted(environment),
        'sourceDigest': prepared['sourceDigest'], 'totalSeconds': 10, 'state': 'consumed-unknown-never-repeat'})
    remaining = 10 - (time.monotonic() - native_started) - 2.5
    if remaining <= 0:
        durable('result.json', {'state': 'NOT_RUN_PRESPAWN_DEADLINE', 'cleanup': 'KEEP', 'queryCalls': 0})
        return
    report = supervisor.supervise(supervisor.Launch((str(native), 'auth', 'status', '--json'), str(scratch),
        environment, supervisor.Ownership.NEW_CHILD_SESSION), supervisor.Policy(min(6, remaining), .25, 1, 65536))
    allowed, parse_failure = parser.safe_status(report.stdout)
    report.stdout = report.stderr = b''
    measurement = meter.measure(meter.Root(str(scratch), original.st_dev, original.st_ino),
        limits=meter.Limits(max_entries=128, max_seconds=.25))
    measured = {key: getattr(measurement, key) for key in ('state', 'logical_bytes', 'allocated_bytes', 'entries',
        'regular_files', 'directories', 'symlinks', 'vanished_entries', 'elapsed_seconds')}
    measured['issueCode'] = measurement.issue.code if measurement.issue else None
    byte_bound = measurement.state == 'complete' and measurement.logical_bytes <= 8388608
    valid = parse_failure is None and report.exit_code == (0 if allowed['loggedIn'] else 1)
    result = {**facts(report), 'publicStatus': allowed, 'parseFailure': parse_failure,
        'state': 'OBSERVED_PUBLIC_STATUS' if valid and byte_bound and report.owned_state == 'absent'
        and all(report.eof.values()) and time.monotonic() - native_started < 10 else 'UNKNOWN',
        'measurement': measured, 'privateByteBound': byte_bound, 'rawOutputArchivedOrHashed': False,
        'queryCalls': 0, 'interactiveAuthCalls': 0, 'credentialFilesReadByCaller': 0,
        'queryAuthenticationOrModelQualified': False, 'nativeSubsegmentMs': round((time.monotonic() - native_started) * 1000),
        'cleanup': 'KEEP', 'cleanupReason': 'NATIVE_INITIALIZATION_FILES_NOT_DELETED; original empty-only cleanup not broadened'}
    durable('result.json', result)
    # Preserve nonempty initialization material; no new recursive cleanup authority.
    current = scratch.lstat()
    cleanup = {'at': utc(), 'state': 'KEEP', 'sameRoot': (current.st_dev, current.st_ino, current.st_uid) ==
        (original.st_dev, original.st_ino, os.getuid()), 'reason': result['cleanupReason'],
        'nativeTotalMs': round((time.monotonic() - native_started) * 1000),
        'preparationAndRunMs': round((time.monotonic() - preparation_started) * 1000),
        'nativeTotalWithin10s': time.monotonic() - native_started < 10}
    durable('cleanup.json', cleanup)
    print(json.dumps({'state': result['state'], 'publicStatus': allowed, 'exitCode': report.exit_code,
        'ownedState': report.owned_state, 'cleanup': cleanup['state'], 'nativeTotalMs': cleanup['nativeTotalMs']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'state': 'UNKNOWN_OR_NOT_RUN', 'errorType': type(error).__name__}))
        sys.exit(1)
