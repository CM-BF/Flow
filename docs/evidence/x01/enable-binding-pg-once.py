"""X01 Stage C resource caller; OPS14 alone owns process supervision. No import-time launch."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
HERE = ROOT / 'docs/evidence/x01'
RUN = HERE / 'enable-binding-stage-c-run-r3'
NODE = '/opt/homebrew/opt/node@24/bin/node'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
OPS_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
FACTS = HERE / 'enable-binding-check-once.py'
FACTS_SHA = 'cfe2b708c762752926f1f24899120fd802ea97e80bc115fabcea12c0b3a3847a'
TESTS = ['apps/server/src/plugin-runtime/runtime.test.ts', 'apps/server/src/plugins/plugins.test.ts']


def digest(data): return hashlib.sha256(data).hexdigest()
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module


def read_regular(path, limit):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > limit: raise ValueError('Unexpected regular input')
        data = bytearray()
        while len(data) <= limit:
            part = os.read(fd, min(65536, limit + 1 - len(data)))
            if not part: break
            data.extend(part)
        after = os.fstat(fd)
        if len(data) != before.st_size or (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns): raise ValueError('Input changed')
        return bytes(data)
    finally: os.close(fd)


def save(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as file: file.write(data); file.flush(); os.fsync(file.fileno())
    parent = os.open(path.parent, os.O_RDONLY | os.O_NOFOLLOW)
    try: os.fsync(parent)
    finally: os.close(parent)
    return len(data)


def tree_sample(root, identity, deadline, limits):
    rows = []; total = 0
    def walk(path):
        nonlocal total
        if time.monotonic() >= deadline: raise TimeoutError('Inventory deadline')
        item = path.lstat()
        if len(rows) >= limits['temporaryEntries'] or not (stat.S_ISDIR(item.st_mode) or stat.S_ISREG(item.st_mode)): raise ValueError('Inventory incomplete')
        total += item.st_size if stat.S_ISREG(item.st_mode) else 0
        if total > limits['temporaryBytes']: raise ValueError('Temporary sample over budget')
        rows.append((path, item.st_dev, item.st_ino, stat.S_ISDIR(item.st_mode)))
        if stat.S_ISDIR(item.st_mode):
            with os.scandir(path) as entries:
                while True:
                    if time.monotonic() >= deadline: raise TimeoutError('Inventory deadline')
                    if len(rows) >= limits['temporaryEntries']: raise ValueError('Inventory entry limit')
                    try: entry = next(entries)
                    except StopIteration: break
                    walk(path / entry.name)
    first = root.lstat()
    if (first.st_dev, first.st_ino) != identity: raise ValueError('Root identity changed')
    walk(root)
    return rows, total


def remove_sample(rows, deadline):
    for path, dev, ino, directory in reversed(rows):
        if time.monotonic() >= deadline: raise TimeoutError('Cleanup deadline')
        current = path.lstat()
        if (current.st_dev, current.st_ino) != (dev, ino) or stat.S_ISDIR(current.st_mode) != directory: raise ValueError('Cleanup identity changed')
        path.rmdir() if directory else path.unlink()


def assert_directory(path, identity):
    item = path.lstat()
    if not stat.S_ISDIR(item.st_mode) or (item.st_dev, item.st_ino) != identity or path.resolve() != path:
        raise ValueError('Directory identity changed')


def suite_confirmed(name, rows, window, head):
    reservation, request, created, result = [rows[key] for key in ['reservation', 'create-request', 'created', 'result']]
    database = reservation['database']
    for row in rows.values():
        if (row['window'], row['sourceHead'], row['suite'], row['database']) != (window, head, name, database): return False
    identity = created['identity']; cleanup = result['cleanup']
    return (re.fullmatch(r'flow_x01_[a-f0-9]{32}', database) is not None
            and identity['owner'] == request['owner'] and identity['marker'] == request['marker']
            and re.fullmatch(r'[0-9]+', identity['oid']) is not None
            and cleanup['identity'] == identity and cleanup['ownersClosed'] is True
            and all(value is True for value in cleanup['owners'].values())
            and all(cleanup[key] is True for key in ['poolClosed', 'adminClosed', 'createRequested', 'createAcknowledged', 'creationReceiptSaved', 'identityConfirmed', 'dropRequested', 'dropAcknowledged', 'databaseAbsent'])
            and cleanup['connections'] == 0 and result['cleanupConfirmed'] is True and result['retainedDatabase'] is None
            and result['errors'] == [] and result['errorCount'] == 0
            and listeners_closed(result['listeners']))


def listeners_closed(listeners):
    # Early assertion failure can skip the planned restart; qualify actual instances only.
    if not isinstance(listeners, list) or not listeners: return False
    for listener in listeners:
        if not isinstance(listener, dict) or listener.get('closed') is not True: return False
        origin = listener.get('origin')
        if not isinstance(origin, str): return False
        match = re.fullmatch(r'http://127\.0\.0\.1:([1-9][0-9]{0,4})', origin)
        if match is None or int(match[1]) > 65535: return False
    return True


def child():
    # Same PID before exec; failure to durably identify this process means zero Vitest/PG execution.
    os.umask(0o077)
    window = os.environ['FLOW_X01_PG_WINDOW']; head = os.environ['FLOW_X01_PG_HEAD']
    if not re.fullmatch('[a-f0-9]{32}', window) or not re.fullmatch('[a-f0-9]{40}', head): raise ValueError('Child identity')
    save(RUN / 'launch.json', {'window': window, 'sourceHead': head, 'pid': os.getpid(), 'pgid': os.getpgrp(), 'at': stamp()})
    argv = [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/x01/enable-binding-pg-vitest.config.mjs', '--configLoader', 'native', '--reporter=json', '--outputFile=' + str(Path(os.environ['FLOW_X01_PG_ROOT']).parent / 'vitest.json'), *TESTS]
    os.execve(NODE, argv, os.environ)


def main():
    # Admission is a fresh co-lead coordination receipt, not a cryptographic authorization scheme.
    if len(sys.argv) != 5 or sys.argv[1] != '--admission' or not Path(sys.argv[2]).is_absolute() or sys.argv[3] != '--sha256' or not re.fullmatch('[a-f0-9]{64}', sys.argv[4]): raise ValueError('Explicit admission path and hash required')
    started = time.monotonic(); wall = time.time(); limits = json.loads(read_regular(HERE / 'enable-binding-pg-r3-input.json', 8192))
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
        claim = json.loads(read_regular(HERE / 'enable-binding-amend-v8.json', 8192))['claim']
        if admission['lead'] != 'mika' or admission['stage'] != 'X01_STAGE_C_PG' or admission['state'] != 'OPEN': raise ValueError('Window not open')
        for key in ['claimId', 'version', 'state', 'lead', 'worker', 'worktree', 'branch', 'scope']:
            if admission['claim'][key] != claim[key]: raise ValueError('Claim changed')
        age = wall - datetime.datetime.fromisoformat(admission['ledgerObservedAt'].replace('Z', '+00:00')).timestamp()
        if not 0 <= age <= 60: raise ValueError('Admission stale')
        head, window = admission['head'], admission['window']
        if not re.fullmatch('[a-f0-9]{40}', head) or not re.fullmatch('[a-f0-9]{32}', window): raise ValueError('Invalid window/head')
        manifest_raw = read_regular(HERE / 'enable-binding-pg-r3-manifest.json', 524288)
        if digest(manifest_raw) != admission['manifestSha256']: raise ValueError('Prepared inputs changed')
        manifest = json.loads(manifest_raw)
        for row in manifest['files']:
            gate(20); data = read_regular(ROOT / row['path'], 1048576)
            if len(data) != row['bytes'] or digest(data) != row['sha256']: raise ValueError('Fixed source changed')
        for row in manifest['external']:
            path = Path(row['path'])
            if str(path.resolve()) != row['realpath']: raise ValueError('External identity changed')
            data = read_regular(path.resolve(), 1048576)
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
        git = ops.supervise(ops.Launch(('/usr/bin/git', 'status', '--porcelain=v2', '--branch', '--untracked-files=all'), str(ROOT), dict(os.environ), ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(3, .25, .75, 32768))
        process, unknown = facts.supervision_facts(git, 'git-preflight'); report['processes'].append(process); report['unknown'] |= unknown
        write('preflight.stdout', git.stdout)
        lines = git.stdout.decode().splitlines(); other = [line for line in lines if not line.startswith('# ') and not (line.startswith('? docs/evidence/x01/enable-binding-stage-c-run-r3/') and line.rsplit('/', 1)[-1] in {'admission.json', 'reservation.json'})]
        if unknown or git.exit_code != 0 or '# branch.oid ' + head not in lines or '# branch.head codex/plugin-enable-binding' not in lines or other: raise ValueError('Working tree not fixed')
        gate(25)
        if time.monotonic() - started >= 15: raise TimeoutError('PG start cutoff')
        temporary = Path(tempfile.mkdtemp(prefix='flow-x01-pg-')); item = temporary.lstat(); identity = (item.st_dev, item.st_ino)
        report['temporary'] = {'path': str(temporary), 'dev': item.st_dev, 'ino': item.st_ino, 'removed': False}
        temporary = temporary.resolve(); assert_directory(temporary, identity)
        report['temporary']['path'] = str(temporary)
        for name in ['fixtures', 'cache', 'tmp']: (temporary / name).mkdir(mode=0o700)
        env = dict(os.environ)
        for key in ['NODE_PG_FORCE_NATIVE', 'NODE_COMPILE_CACHE', 'DATABASE_URL', 'TEST_DATABASE_URL', 'FLOW_COORDINATION_DATABASE_URL']: env.pop(key, None)
        env.update(TMPDIR=str(temporary / 'tmp'), TMP=str(temporary / 'tmp'), TEMP=str(temporary / 'tmp'), NODE_DISABLE_COMPILE_CACHE='1', FLOW_X01_BINDING_CACHE=str(temporary / 'cache'), FLOW_X01_PG_ROOT=str(temporary / 'fixtures'), FLOW_X01_PG_WINDOW=window, FLOW_X01_PG_HEAD=head, FLOW_X01_PG_WORK_UNTIL=str(int((wall + limits['workSeconds']) * 1000)), FLOW_X01_PG_CLEANUP_UNTIL=str(int((wall + limits['workSeconds'] + limits['cleanupSeconds']) * 1000)))
        if time.monotonic() - started >= 15: raise TimeoutError('PG start cutoff after reservation')
        report['PGMayHaveStarted'] = True
        result = ops.supervise(ops.Launch((sys.executable, '-B', str(Path(__file__).resolve()), '--child'), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(max(.1, deadline - time.monotonic() - 8), 1, 1, limits['streamsBytes']))
        process, unknown = facts.supervision_facts(result, 'vitest'); report['processes'].append(process); report['unknown'] |= unknown
        write('output.log', result.stdout)
        if unknown: raise ValueError('Process/capture unresolved')
        checkpoint_raw = read_regular(RUN / 'launch.json', 8192)
        written += len(checkpoint_raw)
        checkpoint = json.loads(checkpoint_raw)
        if checkpoint != {**checkpoint, 'window': window, 'sourceHead': head, 'pid': result.pid, 'pgid': result.pid}: report['unknown'] = True; raise ValueError('Launch checkpoint mismatch')
        for suite in ['runtime', 'registry']:
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
            report['suites'][suite] = rows['result']
            if not suite_confirmed(suite, rows, window, head): report['unknown'] = True; raise ValueError('Database/listener closure unresolved')
            if rows['result']['httpRequests'] > limits['suites'][suite]['httpRequests'] or rows['result']['responseBytes'] > limits['responseBytesPerSuite']: raise ValueError('HTTP accounting limit')
        data = read_regular(temporary / 'vitest.json', limits['resultBytes']); write('vitest.json', data); tests = json.loads(data)
        report['selection'] = {key: tests[key] for key in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'success']}
        report['httpRequests'] = sum(s['httpRequests'] for s in report['suites'].values())
        report['responseBytes'] = sum(s['responseBytes'] for s in report['suites'].values())
        expected = json.loads(read_regular(HERE / 'enable-binding-stage-c-analysis.json', 16384))['collectedNames']
        actual = [(str(Path(file['name']).relative_to(ROOT)), case['title'], case['status']) for file in tests['testResults'] for case in file['assertionResults']]
        expected_names = sorted((str(Path(case['file']).relative_to(ROOT)), case['name']) for case in expected)
        report['exactSelection'] = sorted((path, title) for path, title, status in actual) == expected_names
        report['allAssertionsPassed'] = all(status == 'passed' for path, title, status in actual)
        report['state'] = 'PASSED' if report['exactSelection'] and report['allAssertionsPassed'] and result.exit_code == 0 and tests['numTotalTests'] == 27 and tests['numPassedTests'] == 27 and tests['numFailedTests'] == 0 and tests['numPendingTests'] == 0 and tests['success'] else 'FAILED'
    except BaseException as error:
        report['failure'] = {'type': type(error).__name__}
        report['state'] = 'UNKNOWN' if report['PGMayHaveStarted'] or report['unknown'] else 'HOLD'
        if report['PGMayHaveStarted']: report['unknown'] = True
    finally:
        if temporary is not None:
            try:
                if report['unknown'] or len(report['suites']) != 2: raise ValueError('Keep resources with incomplete evidence')
                rows, size = tree_sample(temporary, identity, deadline - 2, limits)
                report['temporary'].update(sampleBytes=size, sampleEntries=len(rows))
                remove_sample(rows, deadline - 2)
                report['temporary']['removed'] = not temporary.exists()
            except BaseException as error:
                report['unknown'] = True; report['state'] = 'UNKNOWN'; report['retained'].append(report['temporary'])
        report['endedBeforePersistenceAt'] = stamp(); report['elapsedBeforePersistence'] = time.monotonic() - started
        if report['elapsedBeforePersistence'] >= limits['totalSeconds']: report['state'] = 'UNKNOWN'; report['unknown'] = True
        # Count every actual retained output (including a partial child checkpoint), plus uncaptured stream tails.
        try:
            if reserved:
                assert_directory(RUN, run_identity)
                output_sizes = {}
                with os.scandir(RUN) as outputs:
                    while True:
                        gate()
                        if len(output_sizes) >= 24: raise ValueError('Output count limit')
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
            try:
                data = (json.dumps(report, indent=2) + '\n').encode()
                if len(data) > 57344: raise ValueError('Final receipt reserve exceeded')
                if report['rawChargeBeforeReceipt'] is not None and report['rawChargeBeforeReceipt'] + len(data) + 8192 > limits['rawBytes']: raise ValueError('Final receipt over budget')
                save(RUN / 'result.json', data)
            except BaseException:
                print(json.dumps({'state': 'UNKNOWN', 'resultPersistence': 'UNKNOWN', 'temporary': report.get('temporary'), 'run': str(RUN)})); return 1
    print(json.dumps({'state': report['state'], 'run': str(RUN), 'elapsedBeforePersistence': report['elapsedBeforePersistence'], 'retained': report['retained']}))
    return 0 if report['state'] == 'PASSED' else 1


if __name__ == '__main__':
    raise SystemExit(child() if sys.argv[1:] == ['--child'] else main())
