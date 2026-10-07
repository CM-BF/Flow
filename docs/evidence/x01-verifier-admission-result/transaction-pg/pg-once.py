"""Five-case AV03 verifier claim recipe. Process supervision and resource helpers remain the reviewed modules."""
import datetime, hashlib, importlib.util, json, os, re, stat, sys, tempfile, time
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HERE = ROOT / 'docs/evidence/x01-verifier-admission-result/transaction-pg'
RUN = HERE / 'var-transaction-pg-run-r1'
NODE = '/opt/homebrew/opt/node@24/bin/node'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
OPS_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
FACTS = HERE / 'enable-binding-check-once.py'
FACTS_SHA = 'cfe2b708c762752926f1f24899120fd802ea97e80bc115fabcea12c0b3a3847a'

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module); return module

if hashlib.sha256((HERE / 'enable-binding-pg-once.py').read_bytes()).hexdigest() != '86a98a35bfc7fb3a0c3cd01645fa6d48dd3873812b22be7c2236999626417a56': raise ValueError('Fixed resource module changed')
resources = load_module('x01_claim_pg_resources', HERE / 'enable-binding-pg-once.py')
read_regular, save, digest, stamp = resources.read_regular, resources.save, resources.digest, resources.stamp
assert_directory, tree_sample, remove_sample, suite_confirmed = resources.assert_directory, resources.tree_sample, resources.remove_sample, resources.suite_confirmed

def fixed_environment():
    """Only fixed process essentials; no inherited loader or private configuration."""
    return {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC',
        'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1',
        'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_OPTIONAL_LOCKS': '0'}


def pg_environment(temporary, window, head, work_until, cleanup_until):
    return {**fixed_environment(), 'TMPDIR': str(temporary / 'tmp'), 'TMP': str(temporary / 'tmp'),
        'TEMP': str(temporary / 'tmp'), 'FLOW_X01_BINDING_CACHE': str(temporary / 'cache'),
        'FLOW_X01_PG_ROOT': str(temporary / 'fixtures'), 'FLOW_X01_PG_WINDOW': window,
        'FLOW_X01_PG_HEAD': head, 'FLOW_X01_PG_WORK_UNTIL': str(work_until),
        'FLOW_X01_PG_CLEANUP_UNTIL': str(cleanup_until)}


def child():
    os.umask(0o077)
    window, head = os.environ['FLOW_X01_PG_WINDOW'], os.environ['FLOW_X01_PG_HEAD']
    if not re.fullmatch('[a-f0-9]{32}', window) or not re.fullmatch('[a-f0-9]{40}', head): raise ValueError('Child identity')
    save(RUN / 'launch.json', {'window': window, 'sourceHead': head, 'pid': os.getpid(), 'pgid': os.getpgrp(), 'at': stamp()})
    argv = [NODE, str(HERE.parent / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/x01-verifier-admission-result/transaction-pg/vitest.config.mjs', '--configLoader', 'native', '--reporter=json', '--outputFile=' + str(Path(os.environ['FLOW_X01_PG_ROOT']).parent / 'vitest.json'), 'apps/server/src/plugin-runtime/verification-admission-pg.test.ts']
    os.execve(NODE, argv, os.environ)

def persist_final_receipt(report, path, started, deadline):
    """The immutable receipt is a pre-save snapshot; delivery owns the final time verdict."""
    report['recordPhase'] = 'before-final-persistence'
    report['endedBeforePersistenceAt'] = stamp()
    report['elapsedBeforePersistence'] = time.monotonic() - started
    persistence = 'NOT_ATTEMPTED'
    failure = None
    try:
        data = (json.dumps(report, indent=2) + '\n').encode()
        if len(data) > 57344: raise ValueError('Final receipt reserve exceeded')
        charge = report['rawChargeBeforeReceipt']
        if charge is not None and charge + len(data) + 8192 > report['limits']['rawBytes']: raise ValueError('Final receipt over budget')
        if time.monotonic() + 2 >= deadline: raise TimeoutError('Final persistence reserve exhausted')
        persistence = 'UNKNOWN'
        save(path, data)
        persistence = 'CONFIRMED'
    except BaseException as error:
        failure = type(error).__name__
    finished = time.monotonic()
    within_deadline = finished < deadline
    state = report['state'] if persistence == 'CONFIRMED' and within_deadline and failure is None else 'UNKNOWN'
    delivery = {'state': state, 'run': str(path.parent), 'receiptState': report['state'],
        'resultPersistence': persistence, 'elapsedAfterPersistence': finished - started,
        'withinTotalDeadline': within_deadline, 'endedAfterPersistenceAt': stamp(),
        'retained': report['retained'], 'temporary': report.get('temporary')}
    if failure is not None: delivery['failureType'] = failure
    return delivery, 0 if state == 'PASSED' else 1

def main():
    # Admission is a fresh co-lead coordination receipt, not a cryptographic authorization scheme.
    if len(sys.argv) != 5 or sys.argv[1] != '--admission' or not Path(sys.argv[2]).is_absolute() or sys.argv[3] != '--sha256' or not re.fullmatch('[a-f0-9]{64}', sys.argv[4]): raise ValueError('Explicit admission path and hash required')
    started = time.monotonic(); wall = time.time(); limits = json.loads(read_regular(HERE / 'pg-input.json', 8192))
    deadline = started + limits['totalSeconds']; report = {'startedAt': stamp(), 'state': 'HOLD', 'unknown': False, 'limits': limits, 'processes': [], 'suites': {}, 'PGMayHaveStarted': False, 'retained': [], 'temporaryPeak': 'UNKNOWN'}
    written = 0; temporary = None; identity = None; reserved = False; run_identity = None
    def gate(reserve=0):
        if time.monotonic() + reserve >= deadline: raise TimeoutError('Whole window deadline')
    def write(name, value):
        nonlocal written
        gate()
        assert_directory(RUN, run_identity)
        data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
        if written + len(data) > limits['rawBytes'] - 65536: raise ValueError('Receipt/output budget')
        written += save(RUN / name, data)
    try:
        admission_raw = read_regular(Path(sys.argv[2]), 8192)
        if digest(admission_raw) != sys.argv[4]: raise ValueError('Admission changed')
        admission = json.loads(admission_raw)
        claim = json.loads(read_regular(HERE / 'claim-receipt.json', 8192))['claim']
        if admission['lead'] != 'mika' or admission['stage'] != 'VAR_TRANSACTION_PG' or admission['state'] != 'OPEN': raise ValueError('Window not open')
        for key in ['claimId', 'version', 'state', 'lead', 'worker', 'worktree', 'branch', 'scope']:
            if admission['claim'][key] != claim[key]: raise ValueError('Claim changed')
        age = wall - datetime.datetime.fromisoformat(admission['ledgerObservedAt'].replace('Z', '+00:00')).timestamp()
        if not 0 <= age <= 60: raise ValueError('Admission stale')
        head, window = admission['head'], admission['window']
        if not re.fullmatch('[a-f0-9]{40}', head) or not re.fullmatch('[a-f0-9]{32}', window): raise ValueError('Invalid window/head')
        manifest_raw = read_regular(HERE / 'manifest.json', 524288)
        if digest(manifest_raw) != admission['manifestSha256']: raise ValueError('Prepared inputs changed')
        manifest = json.loads(manifest_raw)
        for row in manifest['files']:
            gate(20); data = read_regular(ROOT / row['path'], 1048576)
            if len(data) != row['bytes'] or digest(data) != row['sha256']: raise ValueError('Fixed source changed')
        for row in manifest['external']:
            path = Path(row['path'])
            if str(path.resolve()) != row['realpath']: raise ValueError('External identity changed')
            data = read_regular(path.resolve(), 33554432)
            if len(data) != row['bytes'] or digest(data) != row['sha256']: raise ValueError('External bytes changed')
        for row in manifest['links']:
            if not Path(row['destination']).is_symlink() or str(Path(row['destination']).resolve()) != row['target']: raise ValueError('Dependency link changed')
        paired = admission['pairedBytes']
        if type(paired) is not int or paired < 0: raise ValueError('Invalid paired budget')
        free = os.statvfs(ROOT); available = free.f_bavail * free.f_frsize
        if limits['databaseReserveBytes'] != 134217728: raise ValueError('Fixed DB/WAL reserve required')
        floor = limits['reserveBytes'] + limits['temporaryBytes'] + limits['rawBytes'] + limits['databaseReserveBytes'] + paired
        if available < floor: raise ValueError('Resource floor')
        if digest(read_regular(OPS, 65536)) != OPS_SHA or digest(read_regular(FACTS, 65536)) != FACTS_SHA: raise ValueError('Shared implementation changed')
        ops = load_module('x01_pg_ops', OPS); facts = load_module('x01_pg_facts', FACTS)
        RUN.mkdir(mode=0o700); reserved = True
        item = RUN.lstat(); run_identity = (item.st_dev, item.st_ino)
        write('admission.json', admission_raw)
        write('reservation.json', {'window': window, 'head': head, 'startedAt': report['startedAt'], 'availableBytes': available, 'floorBytes': floor, 'databaseReserveBytes': limits['databaseReserveBytes'], 'pairedBytes': paired})
        report.update(window=window, executionHead=head, manifestSha256=admission['manifestSha256'])
        git = ops.supervise(ops.Launch(('/usr/bin/git', 'status', '--porcelain=v2', '--branch', '--untracked-files=all'), str(ROOT), fixed_environment(), ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(3, .25, .75, 32768))
        process, unknown = facts.supervision_facts(git, 'git-preflight'); report['processes'].append(process); report['unknown'] |= unknown
        write('preflight.stdout', git.stdout)
        lines = git.stdout.decode().splitlines(); other = [line for line in lines if not line.startswith('# ') and not (line.startswith('? docs/evidence/x01-verifier-admission-result/transaction-pg/var-transaction-pg-run-r1/') and line.rsplit('/', 1)[-1] in {'admission.json', 'reservation.json'})]
        if unknown or git.exit_code != 0 or '# branch.oid ' + head not in lines or '# branch.head codex/plugin-verifier-admission-result' not in lines or other: raise ValueError('Working tree not fixed')
        gate(25)
        if time.monotonic() - started >= 15: raise TimeoutError('PG start cutoff')
        temporary = Path(tempfile.mkdtemp(prefix='flow-x01-pg-')); item = temporary.lstat(); identity = (item.st_dev, item.st_ino)
        report['temporary'] = {'path': str(temporary), 'dev': item.st_dev, 'ino': item.st_ino, 'removed': False}
        temporary = temporary.resolve(); assert_directory(temporary, identity)
        report['temporary']['path'] = str(temporary)
        for name in ['fixtures', 'cache', 'tmp']: (temporary / name).mkdir(mode=0o700)
        env = pg_environment(temporary, window, head, int((wall + limits['workSeconds']) * 1000), int((wall + limits['workSeconds'] + limits['cleanupSeconds']) * 1000))
        if time.monotonic() - started >= 15: raise TimeoutError('PG start cutoff after reservation')
        report['PGMayHaveStarted'] = True
        result = ops.supervise(ops.Launch((sys.executable, '-I', '-B', str(Path(__file__).resolve()), '--child'), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(max(.1, deadline - time.monotonic() - 8), 1, 1, limits['streamsBytes']))
        process, unknown = facts.supervision_facts(result, 'vitest'); report['processes'].append(process); report['unknown'] |= unknown
        write('output.log', result.stdout)
        if unknown: raise ValueError('Process/capture unresolved')
        checkpoint_raw = read_regular(RUN / 'launch.json', 8192)
        written += len(checkpoint_raw)
        checkpoint = json.loads(checkpoint_raw)
        if checkpoint != {**checkpoint, 'window': window, 'sourceHead': head, 'pid': result.pid, 'pgid': result.pid}: report['unknown'] = True; raise ValueError('Launch checkpoint mismatch')
        for suite in ['runtime']:
            gate(3); assert_directory(temporary, identity)
            suite_path = temporary / 'fixtures' / suite
            reservation = json.loads(read_regular(suite_path / 'reservation.json', 16384))
            if reservation['directory'] != str(suite_path): raise ValueError('Suite reservation path mismatch')
            suite_identity = (int(reservation['dev']), int(reservation['ino']))
            assert_directory(suite_path, suite_identity)
            rows = {}
            for name in ['reservation', 'create-request', 'created', 'result']:
                gate(3); assert_directory(suite_path, suite_identity)
                data = read_regular(suite_path / (name + '.json'), 16384); write(suite + '-' + name + '.json', data); rows[name] = json.loads(data)
            stage_count = 0
            for ordinal in range(1, 17):
                stage_path = suite_path / ('stage-' + str(ordinal) + '.json')
                try: stage_path.lstat()
                except FileNotFoundError: break
                gate(3); assert_directory(suite_path, suite_identity)
                data = read_regular(stage_path, 16384)
                value = json.loads(data)
                if value['window'] != window or value['sourceHead'] != head or value['suite'] != suite: raise ValueError('Stage identity changed')
                write(suite + '-stage-' + str(ordinal) + '.json', data); stage_count += 1
            report['stageCount'] = stage_count
            report['suites'][suite] = rows['result']
            if not suite_confirmed(suite, rows, window, head): report['unknown'] = True; raise ValueError('Database/listener closure unresolved')
            if rows['result']['httpRequests'] > limits['suites'][suite]['httpRequests'] or rows['result']['responseBytes'] > limits['responseBytesPerSuite']: raise ValueError('HTTP accounting limit')
        data = read_regular(temporary / 'vitest.json', limits['resultBytes']); write('vitest.json', data); tests = json.loads(data)
        report['selection'] = {key: tests[key] for key in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'success']}
        report['httpRequests'] = sum(s['httpRequests'] for s in report['suites'].values())
        report['responseBytes'] = sum(s['responseBytes'] for s in report['suites'].values())
        expected = limits['selection']
        all_cases = [(str(Path(file['name']).relative_to(ROOT)), case['title'], case['status']) for file in tests['testResults'] for case in file['assertionResults']]
        actual = [case for case in all_cases if case[2] not in ('pending', 'skipped', 'todo')]
        report['unselectedCount'] = len(all_cases) - len(actual)
        report['selectedCount'] = len(actual)
        expected_names = sorted((case['file'], case['name']) for case in expected)
        report['exactSelection'] = sorted((path, title) for path, title, status in actual) == expected_names
        report['allAssertionsPassed'] = all(status == 'passed' for path, title, status in actual)
        report['state'] = 'PASSED' if report['exactSelection'] and report['allAssertionsPassed'] and result.exit_code == 0 and len(actual) == 5 and tests['numPassedTests'] == 5 and tests['numFailedTests'] == 0 and tests['success'] else 'FAILED'
    except BaseException as error:
        report['failure'] = {'type': type(error).__name__}
        report['state'] = 'UNKNOWN' if report['PGMayHaveStarted'] or report['unknown'] else 'HOLD'
        if report['PGMayHaveStarted']: report['unknown'] = True
    finally:
        if temporary is not None:
            try:
                if report['unknown'] or len(report['suites']) != 1: raise ValueError('Keep resources with incomplete evidence')
                rows, size = tree_sample(temporary, identity, deadline - limits['finalReserveSeconds'], limits)
                report['temporary'].update(sampleBytes=size, sampleEntries=len(rows))
                remove_sample(rows, deadline - limits['finalReserveSeconds'])
                report['temporary']['removed'] = not temporary.exists()
            except BaseException as error:
                report['unknown'] = True; report['state'] = 'UNKNOWN'; report['retained'].append(report['temporary'])
        # Count every actual retained output (including a partial child checkpoint), plus uncaptured stream tails.
        try:
            if reserved:
                assert_directory(RUN, run_identity)
                output_sizes = {}
                with os.scandir(RUN) as outputs:
                    while True:
                        gate(3)
                        if len(output_sizes) >= 40: raise ValueError('Output count limit')
                        try: entry = next(outputs)
                        except StopIteration: break
                        item = (RUN / entry.name).lstat()
                        if not stat.S_ISREG(item.st_mode): raise ValueError('Unexpected output kind')
                        output_sizes[entry.name] = item.st_size
                written = sum(output_sizes.values())
                report['outputBytesBeforeReceipt'] = output_sizes
            tail = sum(max(0, process['observed_bytes'] - process['retained_bytes']) for process in report['processes'])
            report['uncapturedStreamBytes'] = tail
            report['rawChargeBeforeReceipt'] = written + tail
            if written + tail > limits['rawBytes'] - 65536: raise ValueError('Final accounting over budget')
        except BaseException:
            report['unknown'] = True; report['state'] = 'UNKNOWN'; report['rawChargeBeforeReceipt'] = None
        report['completeAccounting'] = not report['unknown']
        report['rawBytesBeforeReceipt'] = written
        if reserved:
            delivery, code = persist_final_receipt(report, RUN / 'result.json', started, deadline)
        else:
            delivery = {'state': report['state'], 'run': str(RUN), 'resultPersistence': 'NOT_RESERVED',
                'elapsedAfterPersistence': time.monotonic() - started, 'retained': report['retained']}
            code = 1
    print(json.dumps(delivery), flush=True)
    # Stdout delivery can itself block; do not return success after the same origin deadline.
    return code if time.monotonic() < deadline else 1


if __name__ == '__main__':
    raise SystemExit(child() if sys.argv[1:] == ['--child'] else main())
