"""One fixed A/B public status observation. Native output stays in memory."""
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
RUN = BASE.parent / 'auth-home-factor-once'
LOGICAL_ID = 'O16-HOME-FACTOR-PUBLIC-STATUS-ONCE'
QUEUE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/host-i01-newpair-queue-20261007/current.json')
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
METER = SUPERVISOR.parent.parent / 'owned-resource-measurement/measure.py'
PARSER = BASE.parent / 'native-stages/auth-status-once.py'
OLD_CALLER = BASE.parent / 'same-runtime-auth-candidate/run.py'
NODE = '/opt/homebrew/opt/node@24/bin/node'
MAX_RECORD_BYTES = 131072
CLAIM = {'claimId': '55c4e833-bd78-44d4-ba07-e18cd75f00b4', 'version': 1,
         'worker': 'native_center_owner', 'branch': 'codex/continuous-native-goal-acceptance'}


def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            value.update(block)
    return value.hexdigest()


def read_json(path):
    return json.loads(path.read_bytes())


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def durable(name, value):
    encoded = (json.dumps(value, indent=2) + '\n').encode()
    used = sum(p.stat().st_size for p in RUN.iterdir() if p.is_file())
    if used + len(encoded) > MAX_RECORD_BYTES:
        raise ValueError('SAFE_RECORD_LIMIT')
    fd = os.open(RUN / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(RUN, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def validate_grant(grant, queue, preparation_sha, now):
    if (grant.get('logicalId') != LOGICAL_ID or grant.get('state') != 'SELECTED'
            or grant.get('preparationSHA256') != preparation_sha
            or grant.get('claim') != CLAIM or grant.get('worktree') != str(ROOT)
            or grant.get('normalAuthenticationWritesAccepted') is not True
            or queue.get('O16HomeFactorGrant') != grant
            or queue.get('actualHolder') is not None or queue.get('currentActual') is not None):
        raise ValueError('GRANT_MISMATCH')
    selected = datetime.datetime.fromisoformat(grant['selectedAt'].replace('Z', '+00:00'))
    latest = datetime.datetime.fromisoformat(grant['latestStart'].replace('Z', '+00:00'))
    if not selected <= now <= latest:
        raise ValueError('GRANT_EXPIRED')
    floor = grant.get('minimumFreshFreeBytes')
    if type(floor) is not int or floor < 1073741824 + 8388608 + MAX_RECORD_BYTES:
        raise ValueError('RESOURCE_BOUNDARY')
    current_floor = queue.get('floor')
    if type(current_floor) is not int or current_floor < 0:
        raise ValueError('RESOURCE_UNKNOWN')
    return max(floor, current_floor)


def verify_pins(preparation):
    for row in preparation['pins']:
        path = Path(row['path'])
        before = path.stat()
        if (str(path.resolve()) != row['realpath'] or before.st_size != row['bytes']
                or sha(path) != row['sha256']):
            raise ValueError('FIXED_INPUT_CHANGED')
        after = path.stat()
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (
                after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise ValueError('FIXED_IDENTITY_CHANGED')


def observe_private(meter, root):
    result = meter.measure(meter.Root(root['path'], root['dev'], root['ino']),
                           limits=meter.Limits(max_entries=128, max_seconds=.25))
    safe = {key: getattr(result, key) for key in ('state', 'logical_bytes', 'allocated_bytes',
            'entries', 'regular_files', 'directories', 'symlinks', 'vanished_entries', 'elapsed_seconds')}
    safe['issueCode'] = result.issue.code if result.issue else None
    return safe, (result.state == 'complete' and result.logical_bytes <= 8388608
                  and result.symlinks == 0)


def worker(deadline_text):
    reservation = read_json(RUN / 'outer-reservation.json')
    if (reservation['parentPid'] != os.getppid() or reservation['workerDeadline'] != deadline_text
            or reservation['logicalId'] != LOGICAL_ID):
        raise ValueError('WORKER_IDENTITY')
    durable('worker-consumed.json', {'at': utc(), 'pid': os.getpid(), 'state': 'CONSUMED_UNKNOWN'})
    deadline = float(deadline_text)
    verify_pins(read_json(BASE / 'execution-preparation.json'))
    original = load('o16_existing_status_caller', OLD_CALLER)
    ops = load('o16_home_ops14', SUPERVISOR)
    meter = load('o16_home_meter', METER)
    parser = load('o16_home_public_parser', PARSER)
    policy = load('o16_home_policy', BASE / 'home_factor.py')
    scratch = Path(tempfile.mkdtemp(prefix='flow-o16-home-factor-', dir='/private/tmp'))
    info = scratch.lstat()
    root = {'path': str(scratch), 'dev': info.st_dev, 'ino': info.st_ino}
    durable('reservation.json', {'kind': 'O16_HOME_FACTOR_AUTH_STATUS_ONCE', 'at': utc(),
        'scratch': root, 'sharedAuthenticationWrites': 'normal native same-account only; not in private8MiB',
        'totalDeadline': deadline_text, 'queryCalls': 0, 'state': 'CONSUMED_UNKNOWN'})
    if deadline - time.monotonic() < 10:
        raise ValueError('PREPARATION_DEADLINE')
    preparation = ops.supervise(ops.Launch((NODE, str(BASE / 'prepare.mjs'), '--prepare-home-factor-once'),
        str(ROOT), {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'HOME': str(scratch), 'TMPDIR': str(scratch),
        'NODE_DISABLE_COMPILE_CACHE': '1'}, ops.Ownership.NEW_CHILD_SESSION), ops.Policy(7, .5, 2, 65536))
    durable('preparation-result.json', original.facts(preparation))
    preparation.stdout = preparation.stderr = b''
    if (preparation.exit_code != 0 or preparation.first_failure is not None
            or preparation.owned_state != 'absent' or not all(preparation.eof.values())):
        raise ValueError('PREPARATION_UNKNOWN')
    prepared = read_json(RUN / 'prepared.json')
    environment = original.public_environment(prepared)
    cases = policy.home_cases(environment, prepared['binding']['folders']['home']['path'])
    native = prepared['binding']['runtime'][2]
    durable('home-difference.json', {'keys': sorted(environment), 'differentKeys': ['HOME'],
        'caseOrder': ['A_PRIVATE_HOME', 'B_NORMAL_HOME'], 'sameCwd': str(scratch),
        'sharedStateMayChangeBetweenCases': True, 'causalAttribution': False})
    decisions = []
    for label, env in zip(('A', 'B'), cases):
        # Never start a native child whose own complete 13s envelope reaches the outer stop boundary.
        if deadline - time.monotonic() < 14:
            raise ValueError('NATIVE_DEADLINE')
        measurement, within = observe_private(meter, root)
        if not within:
            raise ValueError('PRIVATE_BOUNDARY_UNKNOWN')
        if sha(Path(native['path'])) != native['sha256']:
            raise ValueError('NATIVE_CHANGED')
        durable(label.lower() + '-consumed.json', {'at': utc(), 'argv': [native['path'], 'auth', 'status', '--json'],
            'cwd': str(scratch), 'case': label, 'state': 'CONSUMED_UNKNOWN'})
        report = ops.supervise(ops.Launch((native['path'], 'auth', 'status', '--json'), str(scratch), env,
            ops.Ownership.NEW_CHILD_SESSION), ops.Policy(10, .5, 2.5, 65536))
        interpretation = policy.interpret_status(report.stdout, report, parser.safe_status)
        report.stdout = report.stderr = b''
        try:
            measurement, within = observe_private(meter, root)
        except Exception as error:
            measurement, within = {'state': 'unknown', 'errorType': type(error).__name__}, False
        result = {**original.facts(report), **interpretation, 'case': label, 'at': utc(),
            'privateMeasurement': measurement, 'privateWithinBound': within, 'rawArchivedOrHashed': False,
            'sharedHomeOrKeychainWithinPrivateBudget': False, 'queryCalls': 0, 'cleanup': 'KEEP'}
        if not within:
            result['decision'] = 'STOP_UNKNOWN'
        durable(label.lower() + '-observation.json', result)
        decisions.append({'case': label, 'decision': result['decision']})
        if result['decision'] != 'CONTINUE':
            break
    durable('case-disposition.json', {'at': utc(), 'cases': decisions, 'private': 'KEEP',
        'sharedAuthentication': 'native normal operations may have occurred; no caller cleanup',
        'queryCalls': 0, 'accountOrModelQualification': False})


def main(argv):
    if len(argv) == 2 and argv[0] == '--worker':
        try:
            return worker(argv[1])
        except Exception as error:
            # Missing phase receipts remain unknown; a safe caller failure never
            # replaces a native first_failure or authorizes another launch.
            durable('caller-failure.json', {'at': utc(), 'errorType': type(error).__name__,
                'state': 'UNKNOWN', 'nativePhaseWithoutResult': 'KEEP_UNKNOWN', 'queryCalls': 0})
            raise
    if argv != ['--run-home-factor-once']:
        raise ValueError('EXPLICIT_ONCE_ENTRY_REQUIRED')
    started = time.monotonic()
    preparation_path = BASE / 'execution-preparation.json'
    preparation = read_json(preparation_path)
    if (Path.cwd().resolve() != ROOT or
            str(Path(sys.executable).resolve()) != preparation['python']['realpath']):
        raise ValueError('CALLER_RUNTIME_OR_CWD')
    verify_pins(preparation)
    grant = read_json(BASE / 'execution-grant.json')
    queue = read_json(QUEUE)
    floor = validate_grant(grant, queue, sha(preparation_path), datetime.datetime.now(datetime.timezone.utc))
    if RUN.exists() or RUN.is_symlink() or shutil.disk_usage(ROOT).free < floor:
        raise ValueError('NAMESPACE_OR_RESOURCE_GATE')
    ops = load('o16_home_outer_ops14', SUPERVISOR)
    RUN.mkdir(mode=0o700)
    # Exact outer reserve owns only this caller; missing native phase receipts remain UNKNOWN.
    deadline = str(started + 42.5)
    remaining = float(deadline) - time.monotonic()
    if remaining <= 0:
        raise ValueError('PRESPAWN_DEADLINE')
    durable('outer-reservation.json', {'at': utc(), 'logicalId': LOGICAL_ID, 'grant': grant,
        'parentPid': os.getpid(), 'workerDeadline': deadline, 'freeBytes': shutil.disk_usage(ROOT).free,
        'floorBytes': floor, 'state': 'CONSUMED_UNKNOWN'})
    result = ops.supervise(ops.Launch((sys.executable, '-B', str(BASE / 'run.py'), '--worker', deadline),
        str(ROOT), {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'PYTHONDONTWRITEBYTECODE': '1'},
        ops.Ownership.CHILD_PID_ONLY), ops.Policy(remaining, .5, 2, 8192))
    result.stdout = result.stderr = b''
    original = load('o16_home_outer_facts', OLD_CALLER)
    durable('outer-result.json', {**original.facts(result), 'rawArchivedOrHashed': False,
        'ownershipBoundary': 'Only caller PID; missing native receipts remain UNKNOWN',
        'private': 'KEEP', 'sharedAuthenticationCleanup': 'NONE'})


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        # No exception message/stack can quote child output or an auth payload.
        print(json.dumps({'state': 'UNKNOWN_OR_NOT_RUN', 'errorType': type(error).__name__}))
        sys.exit(1)
