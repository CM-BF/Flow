"""Direct pure/owned-FS tests. Importing the caller never invokes its main or PG."""
import copy, hashlib, importlib.util, json, os, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('candidate', HERE / 'pg-once.py')
candidate = importlib.util.module_from_spec(spec); spec.loader.exec_module(candidate)


def sample():
    archived = {}; mains = []; notices = []; outcomes = []
    for n, task in enumerate(('task-2', 'task-3')):
        identity = dict(taskId=task, attemptId='attempt-' + str(n), ownerVersion=1,
            bindingId='binding-' + str(n), invocationId='invoke-' + str(n))
        outcomes.append(identity)
        launch = dict(identity, type='plugin-process', stage='launched', executionKind='verifier',
            workerEntry='flow.runner.process-worker.v1', pid=n + 100, observedAt='2026-10-08T02:00:00.000Z',
            launchedAt='2026-10-08T02:00:00.000Z', exitCode=None, signal=None, protocolEof=False,
            stdoutEof=False, stderrEof=False, processClosed=False, resourceState='reserved', observerError=None)
        notices.extend([launch, dict(launch, stage='settled', exitCode=0, protocolEof=True,
            stdoutEof=True, stderrEof=True, processClosed=True, resourceState='removed')])
    for label in candidate.MAIN_LABELS:
        raw = ('\n'.join(json.dumps(n) for n in notices) + '\n').encode() if label == 'runner-verifier' else b'closed\n'
        archived[label + '.log'] = raw
        mains.append(dict(label=label, pid=50 + len(mains), exitCode=0, signal=None, closed=True,
            stdoutEof=True, stderrEof=True, workDeadlineReached=False, outputBytes=len(raw),
            logSha256=hashlib.sha256(raw).hexdigest()))
    result = {'facts': [{'kind': 'tar', 'exitCode': 0, 'signal': None},
        {'kind': 'process-traffic', 'processes': mains},
        {'kind': 'real-verifier-three-task-process', 'taskIds': ['task-1', 'task-2', 'task-3'],
            'outcomes': outcomes, 'workerNotices': notices}]}
    tests = dict(testResults=[dict(name=str(candidate.ROOT / candidate.TEST_FILE), assertionResults=[
        dict(title=candidate.TARGET, status='passed'), dict(title=candidate.INACTIVE, status='pending')])],
        numPassedTests=1, numFailedTests=0, success=True)
    return archived, result, tests


def selection_and_processes():
    archived, result, tests = sample()
    assert candidate.exact_selection(tests)
    assert candidate.process_evidence(result, archived)
    checked = 2
    for status in ('failed', 'pending', 'unknown'):
        bad = copy.deepcopy(tests); bad['testResults'][0]['assertionResults'][0]['status'] = status
        assert not candidate.exact_selection(bad); checked += 1
    for rows in ([], [dict(title=candidate.TARGET, status='passed'), dict(title=candidate.TARGET, status='pending')],
            [dict(title=candidate.TARGET, status='passed'), dict(title='unexpected', status='passed')]):
        bad = copy.deepcopy(tests); bad['testResults'][0]['assertionResults'] = rows
        assert not candidate.exact_selection(bad); checked += 1
    for key, value in [('attemptId', 'wrong'), ('stdoutEof', False), ('resourceState', 'unknown'), ('pid', 999)]:
        bad = copy.deepcopy(archived); notices = candidate.worker_notices(bad['runner-verifier.log'])
        notices[1][key] = value; bad['runner-verifier.log'] = ('\n'.join(json.dumps(n) for n in notices) + '\n').encode()
        changed = copy.deepcopy(result); process = changed['facts'][1]['processes'][2]
        process.update(outputBytes=len(bad['runner-verifier.log']), logSha256=candidate.digest(bad['runner-verifier.log']))
        assert not candidate.process_evidence(changed, bad); checked += 1
    bad = copy.deepcopy(result); bad['facts'][1]['processes'][0]['closed'] = False
    assert not candidate.process_evidence(bad, archived); checked += 1
    assert not candidate.merged_complete({'owned_state': 'absent', 'exit_code': 0, 'eof': {}, 'observed_bytes': 0, 'retained_bytes': 0})
    print(json.dumps({'group': 'selection', 'assertionScenarios': checked + 1, 'passed': True}))


def failure_archive():
    # This tree is a new child fixture inside the supervisor's registered owned TMP.
    root = Path(os.environ['TMPDIR']) / 'archive'; root.mkdir()
    run = root / 'run'; run.mkdir(); temporary = root / 'temporary'; temporary.mkdir()
    suite = temporary / 'fixtures/runtime'; suite.mkdir(parents=True)
    package = temporary / 'fixtures/process-package'; package.mkdir()
    (run / 'launch.json').write_text('{"pid":10}')
    item = suite.lstat()
    (suite / 'reservation.json').write_text(json.dumps({'directory': str(suite), 'dev': str(item.st_dev), 'ino': str(item.st_ino)}))
    (suite / 'create-request.json').write_text('{"firstFailure":"business"}')
    (suite / 'created.json').write_text('{}')
    (suite / 'stage-1.json').write_text('{"stage":"completed"}')
    archived, result, tests = sample()
    for name in candidate.MAIN_LABELS: (package / (name + '.log')).write_bytes(archived[name + '.log'])
    (temporary / 'vitest.json').write_text(json.dumps(tests))
    retained = {}
    def write(name, data): retained[name] = bytes(data)
    identity = lambda p: (p.lstat().st_dev, p.lstat().st_ino)
    values, errors = candidate.archive_existing(temporary, identity(temporary), run, identity(run), write, time.monotonic() + 10)
    assert errors == [{'file': 'runtime-result.json', 'code': 'MISSING'}], errors
    assert 'runtime-stage-1.json' in retained and 'vitest.json' in retained and 'runner-verifier.log' in retained
    assert values['runtime-create-request.json']['firstFailure'] == 'business'
    assert len(candidate.worker_notices(values['runner-verifier.log'])) == 4
    rows = {key: values.get('runtime-' + key + '.json') for key in ('reservation', 'create-request', 'created', 'result')}
    state, facts = candidate.classify(values, rows, 'window', 'head', 1, False, {})
    assert state == 'UNKNOWN' and facts['cleanupEligible'] is False
    (suite / 'result.json').write_bytes(b'x' * 16385)
    retained.clear(); values, errors = candidate.archive_existing(temporary, identity(temporary), run, identity(run), write, time.monotonic() + 10)
    assert {'file': 'runtime-result.json', 'code': 'ValueError'} in errors
    assert 'vitest.json' in retained and 'runner-verifier.log' in retained and 'runtime-stage-1.json' in retained
    assert (suite / 'result.json').stat().st_size == 16385
    assert 'runtime-result.json' not in retained
    # Caller never removes failed/oversized originals; test owner cleans its own regular files.
    for path in sorted(root.rglob('*'), key=lambda p: len(p.parts), reverse=True):
        if path.is_dir(): path.rmdir()
        else: path.unlink()
    root.rmdir()
    print(json.dumps({'group': 'archive', 'assertionScenarios': 12, 'passed': True}))


if __name__ == '__main__':
    {'selection': selection_and_processes, 'archive': failure_archive}[sys.argv[1]]()
