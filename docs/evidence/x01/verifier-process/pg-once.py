"""One real verifier three-task process recipe. Process supervision and resource helpers remain the reviewed modules."""
import datetime, hashlib, importlib.util, json, os, re, stat, sys, tempfile, time
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HERE = ROOT / 'docs/evidence/x01/verifier-process'
RUN = HERE / 'verifier-process-run-r1'
NODE = '/opt/homebrew/opt/node@24/bin/node'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
OPS_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
FACTS = HERE.parent / 'enable-binding-check-once.py'
FACTS_SHA = 'cfe2b708c762752926f1f24899120fd802ea97e80bc115fabcea12c0b3a3847a'

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module); return module

if hashlib.sha256((HERE.parent / 'enable-binding-pg-once.py').read_bytes()).hexdigest() != '64add9586fbf99458187f1569be3dc8ff17f3ad4d30be1d74a4a9568653ffcf5': raise ValueError('Fixed resource module changed')
resources = load_module('x01_claim_pg_resources', HERE.parent / 'enable-binding-pg-once.py')
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
        'FLOW_X01_PG_CLEANUP_UNTIL': str(cleanup_until),
        'FLOW_X01_VERIFIER_PROCESS_CASE': '1', 'FLOW_X01_PROCESS_TSCONFIG': str(HERE / 'runtime-tsconfig.json'), 'TSX_DISABLE_CACHE': '1'}


def child():
    os.umask(0o077)
    window, head = os.environ['FLOW_X01_PG_WINDOW'], os.environ['FLOW_X01_PG_HEAD']
    if not re.fullmatch('[a-f0-9]{32}', window) or not re.fullmatch('[a-f0-9]{40}', head): raise ValueError('Child identity')
    save(RUN / 'launch.json', {'window': window, 'sourceHead': head, 'pid': os.getpid(), 'pgid': os.getpgrp(), 'at': stamp()})
    argv = [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/x01/verifier-process/vitest.config.mjs', '--configLoader', 'native', '--reporter=json', '--outputFile=' + str(Path(os.environ['FLOW_X01_PG_ROOT']).parent / 'vitest.json'), 'apps/server/src/plugin-runtime/process-runner-pg.test.ts', '-t', '^real center and trusted-process runner verify a failed source and its JSON output$']
    os.execve(NODE, argv, os.environ)

MAIN_LABELS = ('bootstrap-center', 'trusted-center', 'runner-verifier')
TARGET = 'real center and trusted-process runner verify a failed source and its JSON output'
INACTIVE = 'real center and runner entries execute pinned semver before and after clean ACK restart'
TEST_FILE = 'docs/evidence/x01/verifier-process/inputs/apps/server/src/plugin-runtime/process-runner-pg.test.ts'


def merged_complete(process):
    return (process.get('owned_state') == 'absent' and process.get('exit_code') is not None
        and process.get('eof', {}).get('stdout') is True
        and all(process['eof'].values()) and process.get('observed_bytes') == process.get('retained_bytes'))


def archive_existing(temporary, identity, run, run_identity, write, deadline):
    """Every named observation is independent; one missing result never skips later logs."""
    archived, failures = {}, []
    suite = temporary / 'fixtures/runtime'
    named = [('launch.json', run / 'launch.json', 8192, True)]
    named += [('runtime-' + name + '.json', suite / (name + '.json'), 16384, True)
        for name in ('reservation', 'create-request', 'created', 'result')]
    named += [('runtime-stage-' + str(n) + '.json', suite / ('stage-' + str(n) + '.json'), 16384, False)
        for n in range(1, 17)]
    named += [(label + '.log', temporary / 'fixtures/process-package' / (label + '.log'), 65536, True)
        for label in MAIN_LABELS]
    named += [('vitest.json', temporary / 'vitest.json', 131072, True)]
    suite_identity = None
    for name, path, cap, required in named:
        try:
            if time.monotonic() + 3 >= deadline: raise TimeoutError('Archive deadline')
            assert_directory(temporary, identity)
            assert_directory(run, run_identity)
            if path.parent == suite:
                if name == 'runtime-reservation.json':
                    item = suite.lstat(); suite_identity = (item.st_dev, item.st_ino)
                if suite_identity is None: raise ValueError('Suite identity missing')
                assert_directory(suite, suite_identity)
            if path.suffix == '.log':
                package = path.parent; item = package.lstat()
                assert_directory(package, (item.st_dev, item.st_ino))
            data = read_regular(path, cap)
            if path != run / 'launch.json': write(name, data)
            value = json.loads(data) if path.suffix == '.json' else data
            archived[name] = value
            if name == 'runtime-reservation.json' and (value.get('directory') != str(suite)
                    or (int(value.get('dev', -1)), int(value.get('ino', -1))) != suite_identity):
                raise ValueError('Reservation identity mismatch')
        except FileNotFoundError:
            if required: failures.append({'file': name, 'code': 'MISSING'})
        except BaseException as error:
            # No exception text, private input or unbounded file is copied into metadata.
            failures.append({'file': name, 'code': type(error).__name__})
    return archived, failures


def worker_notices(raw):
    notices = []
    for line in raw.splitlines():
        if len(line) > 2048: continue
        try: value = json.loads(line)
        except (ValueError, UnicodeError): continue
        if isinstance(value, dict) and value.get('type') == 'plugin-process':
            # Exact fixed safe fields only. Raw log remains separately archived.
            keys = ('type', 'stage', 'executionKind', 'workerEntry', 'taskId', 'bindingId', 'invocationId',
                'attemptId', 'ownerVersion', 'pid', 'observedAt', 'launchedAt', 'exitCode', 'signal',
                'protocolEof', 'stdoutEof', 'stderrEof', 'processClosed', 'resourceState', 'observerError')
            notices.append({key: value.get(key) for key in keys})
            if len(notices) > 4: raise ValueError('Worker notice bound')
    return notices


def exact_selection(tests):
    rows = [(str(Path(file['name']).relative_to(ROOT)), case['title'], case['status'])
        for file in tests['testResults'] for case in file['assertionResults']]
    target = [row for row in rows if row[:2] == (TEST_FILE, TARGET)]
    others = [row for row in rows if row[:2] != (TEST_FILE, TARGET)]
    return (len(target) == 1 and target[0][2] == 'passed'
        and len(others) <= 1 and all(row[:2] == (TEST_FILE, INACTIVE)
            and row[2] in ('pending', 'skipped', 'todo') for row in others)
        and tests.get('numPassedTests') == 1 and tests.get('numFailedTests') == 0 and tests.get('success') is True)


def process_evidence(fixture_result, archived):
    facts = fixture_result['facts']
    traffic = [row for row in facts if row.get('kind') == 'process-traffic']
    business = [row for row in facts if row.get('kind') == 'real-verifier-three-task-process']
    tar = [row for row in facts if row.get('kind') == 'tar']
    if len(traffic) != 1 or len(business) != 1 or len(tar) != 1: return False
    if tar[0].get('exitCode') != 0 or tar[0].get('signal') is not None: return False
    main = traffic[0]['processes']
    if [p['label'] for p in main] != list(MAIN_LABELS): return False
    for process in main:
        raw = archived[process['label'] + '.log']
        if (type(process.get('pid')) is not int or process['pid'] <= 0 or process.get('exitCode') != 0
            or process.get('signal') is not None or process.get('workDeadlineReached') is not False
            or any(process.get(key) is not True for key in ('closed', 'stdoutEof', 'stderrEof'))
            or process.get('outputBytes') != len(raw) or process.get('logSha256') != digest(raw)): return False
    outcomes = business[0]['outcomes']; notices = worker_notices(archived['runner-verifier.log'])
    if len(outcomes) != 2 or len(notices) != 4 or len(set(business[0]['taskIds'])) != 3: return False
    identity = ('taskId', 'attemptId', 'ownerVersion', 'bindingId', 'invocationId')
    for outcome in outcomes:
        pair = [notice for notice in notices if notice['taskId'] == outcome['taskId']]
        if len(pair) != 2 or [n['stage'] for n in pair] != ['launched', 'settled']: return False
        launch, settled = pair
        if any(n[k] != outcome[k] for n in pair for k in identity): return False
        if any(n['executionKind'] != 'verifier' or n['workerEntry'] != 'flow.runner.process-worker.v1' for n in pair): return False
        if type(launch['pid']) is not int or launch['pid'] <= 0 or not isinstance(launch['launchedAt'], str): return False
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', launch['launchedAt']): return False
        if launch['resourceState'] != 'reserved' or launch['observerError'] is not None: return False
        if settled['pid'] != launch['pid'] or settled['launchedAt'] != launch['launchedAt']: return False
        if (settled['exitCode'] != 0 or settled['signal'] is not None or settled['resourceState'] != 'removed'
            or settled['observerError'] is not None or any(settled[k] is not True
                for k in ('protocolEof', 'stdoutEof', 'stderrEof', 'processClosed'))): return False
    return True


def classify(archived, rows, window, head, exit_code, known, limits):
    """Closure is independent of passing assertions; missing evidence always keeps resources."""
    details = {'cleanupEligible': False, 'exactSelection': False, 'processEvidence': False}
    if not known or any(not isinstance(row, dict) for row in rows.values()): return 'UNKNOWN', details
    try:
        closed = suite_confirmed('runtime', rows, window, head)
        result = rows['result']
        details['processEvidence'] = process_evidence(result, archived)
        details['exactSelection'] = exact_selection(archived['vitest.json'])
        details['selection'] = {k: archived['vitest.json'].get(k) for k in
            ('numPassedTests', 'numFailedTests', 'numPendingTests', 'success')}
        details['httpRequests'] = result['httpRequests']; details['responseBytes'] = result['responseBytes']
        details['cleanupEligible'] = (closed and details['processEvidence']
            and result['httpRequests'] <= limits['suites']['runtime']['httpRequests']
            and result['responseBytes'] <= limits['responseBytesPerSuite'])
        if not details['cleanupEligible']: return 'UNKNOWN', details
        return ('PASSED' if details['exactSelection'] and exit_code == 0 else 'FAILED'), details
    except (KeyError, TypeError, ValueError, UnicodeError):
        return 'UNKNOWN', details

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
    started = time.monotonic(); wall = time.time(); limits = json.loads(read_regular(HERE / 'pg-operator-input.json', 8192))
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
        claim = limits['claim']
        if admission['lead'] != 'mika' or admission['stage'] != 'X01_VERIFIER_PROCESS_PG' or admission['state'] != 'OPEN': raise ValueError('Window not open')
        for key in ['claimId', 'version', 'state', 'lead', 'worker', 'worktree', 'branch', 'scope']:
            if admission['claim'][key] != claim[key]: raise ValueError('Claim changed')
        age = wall - datetime.datetime.fromisoformat(admission['ledgerObservedAt'].replace('Z', '+00:00')).timestamp()
        if not 0 <= age <= 60: raise ValueError('Admission stale')
        head, window = admission['head'], admission['window']
        if not re.fullmatch('[a-f0-9]{40}', head) or not re.fullmatch('[a-f0-9]{32}', window): raise ValueError('Invalid window/head')
        manifest_raw = read_regular(HERE / 'pg-operator-manifest.json', 524288)
        if digest(manifest_raw) != admission['manifestSha256']: raise ValueError('Prepared inputs changed')
        manifest = json.loads(manifest_raw)
        fixed_rows = list(manifest['files'])
        for row in fixed_rows:
            data = read_regular(ROOT / row['path'], 1048576)
            if len(data) != row['bytes'] or digest(data) != row['sha256']: raise ValueError('Operator input changed')
        source_inputs = json.loads(read_regular(HERE / 'execution-inputs.json', 262144))
        external_inputs = json.loads(read_regular(HERE / 'external-inputs.json', 65536))
        for row in source_inputs['files']:
            gate(20); data = read_regular(ROOT / row['path'], 1048576)
            if len(data) != row['bytes'] or digest(data) != row['sha256']: raise ValueError('Fixed source changed')
        for row in external_inputs['external']:
            path = Path(row['path'])
            if str(path.resolve()) != row['realpath']: raise ValueError('External identity changed')
            data = read_regular(path.resolve(), 33554432)
            if len(data) != row['bytes'] or digest(data) != row['sha256']: raise ValueError('External bytes changed')
        for row in external_inputs['links']:
            if not Path(row['path']).is_symlink() or str(Path(row['path']).resolve()) != row['target']: raise ValueError('Dependency link changed')
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
        lines = git.stdout.decode().splitlines(); other = [line for line in lines if not line.startswith('# ') and not (line.startswith('? docs/evidence/x01/verifier-process/verifier-process-run-r1/') and line.rsplit('/', 1)[-1] in {'admission.json', 'reservation.json'})]
        if unknown or git.exit_code != 0 or '# branch.oid ' + head not in lines or '# branch.head codex/plugin-enable-binding' not in lines or other: raise ValueError('Working tree not fixed')
        gate(25)
        if time.monotonic() - started >= 15: raise TimeoutError('PG start cutoff')
        temporary = Path(tempfile.mkdtemp(prefix='flow-x01-verifier-pg-')).resolve(); item = temporary.lstat(); identity = (item.st_dev, item.st_ino)
        report['temporary'] = {'path': str(temporary), 'dev': item.st_dev, 'ino': item.st_ino, 'removed': False}
        temporary = temporary.resolve(); assert_directory(temporary, identity)
        report['temporary']['path'] = str(temporary)
        for name in ['fixtures', 'cache', 'tmp']: (temporary / name).mkdir(mode=0o700)
        env = pg_environment(temporary, window, head, int((wall + limits['workSeconds']) * 1000), int((wall + limits['workSeconds'] + limits['cleanupSeconds']) * 1000))
        if time.monotonic() - started >= 15: raise TimeoutError('PG start cutoff after reservation')
        report['PGMayHaveStarted'] = True
        result = ops.supervise(ops.Launch((sys.executable, '-I', '-B', str(Path(__file__).resolve()), '--child'), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(max(.1, deadline - time.monotonic() - 8), 1, 1, limits['streamsBytes']))
        process, unknown = facts.supervision_facts(result, 'vitest'); report['processes'].append(process); report['unknown'] |= unknown
        report['firstFailure'] = process.get('first_failure')
        output_failure = []
        try: write('output.log', result.stdout)
        except BaseException as error: output_failure.append({'file': 'output.log', 'code': type(error).__name__})
        # Preserve independent readable evidence before classifying any missing or malformed receipt.
        archived, archive_failures = archive_existing(temporary, identity, RUN, run_identity, write, deadline)
        archive_failures = output_failure + archive_failures
        report['archiveFailures'] = archive_failures
        report['firstFailure'] = process.get('first_failure')
        report['secondaryFailures'] = list(process.get('secondary_failures', []))
        checkpoint = archived.get('launch.json')
        valid_checkpoint = isinstance(checkpoint, dict) and all(checkpoint.get(k) == v for k, v in
            {'window': window, 'sourceHead': head, 'pid': result.pid, 'pgid': result.pid}.items())
        rows = {key: archived.get('runtime-' + key + '.json') for key in ['reservation', 'create-request', 'created', 'result']}
        report['suites']['runtime'] = rows['result']
        report['observedWorkerNotices'] = worker_notices(archived.get('runner-verifier.log', b''))
        known = not unknown and merged_complete(process) and valid_checkpoint and not archive_failures
        report['state'], details = classify(archived, rows, window, head, result.exit_code, known, limits)
        report.update(details)
        report['unknown'] = report['state'] == 'UNKNOWN'
        if report['firstFailure'] is None and report['state'] != 'PASSED':
            report['firstFailure'] = {'code': 'CASE_FAILED' if report['state'] == 'FAILED' else 'EVIDENCE_INCOMPLETE'}
    except BaseException as error:
        report.setdefault('firstFailure', {'code': type(error).__name__})
        report['failure'] = {'type': type(error).__name__}
        report['state'] = 'UNKNOWN' if report['PGMayHaveStarted'] or report['unknown'] else 'HOLD'
        if report['PGMayHaveStarted']: report['unknown'] = True
    finally:
        if temporary is not None:
            if 'archiveFailures' not in report:
                try:
                    archived, failures = archive_existing(temporary, identity, RUN, run_identity, write, deadline)
                    report['archiveFailures'] = failures
                    report['observedWorkerNotices'] = worker_notices(archived.get('runner-verifier.log', b''))
                except BaseException as error:
                    report['archiveFailures'] = [{'code': type(error).__name__}]
                report['unknown'] = True; report['state'] = 'UNKNOWN'
            try:
                if report['unknown'] or not report.get('cleanupEligible'): raise ValueError('Keep resources with incomplete evidence')
                rows, size = tree_sample(temporary, identity, deadline - limits['finalReserveSeconds'], limits)
                report['temporary'].update(sampleBytes=size, sampleEntries=len(rows))
                remove_sample(rows, deadline - limits['finalReserveSeconds'])
                try: temporary.lstat(); raise ValueError('Temporary root still present')
                except FileNotFoundError: report['temporary']['removed'] = True
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
                        if len(output_sizes) >= 48: raise ValueError('Output count limit')
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
