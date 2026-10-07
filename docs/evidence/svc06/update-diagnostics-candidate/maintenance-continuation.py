"""Fixed procedural calls to existing helpers and public maintenance, supervised by OPS14."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import time

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
PLAN = json.loads((BASE / 'maintenance-continuation.json').read_bytes())


def bindings():
    for item in PLAN['sourceBindings']:
        raw = (BASE / item['path']).read_bytes()
        assert len(raw) == item['bytes'] and hashlib.sha256(raw).hexdigest() == item['sha256']
    for key in ['inputs', 'completedResult']:
        item = PLAN[key]
        assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() == item['sha256']
    inputs = json.loads(Path(PLAN['inputs']['path']).read_bytes())
    for item in [*inputs['runtimePins'], *PLAN['observerPins'], PLAN['factsReaderPin']]:
        path = Path(item['path']); info = path.lstat()
        assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and str(path.resolve()) == item['realpath']
        assert (str(info.st_dev), str(info.st_ino), info.st_uid, info.st_nlink, info.st_size) == (item['dev'], item['ino'], item['uid'], item['nlink'], item['bytes'])
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
    return inputs


def invocations():
    expected = ['facts-before', 'preflight', 'history-before', 'bootstrap', 'operation', 'refresh', 'facts-paused', 'history-paused', 'checkpoint', 'resume', 'facts-final', 'final']
    assert [step['name'] for step in PLAN['steps']] == expected
    installed = str(Path(PLAN['directory']) / 'backend-artifacts' / PLAN['artifact']['artifactId'] / 'root')
    for step in PLAN['steps']:
        assert step['argv'][0] == PLAN['node'] and step['ownership'] == 'childPidOnly'
        assert step['cwd'] == (installed if step['name'] in ['refresh', 'resume'] else PLAN['repository'])
        if step['name'] in ['bootstrap', 'refresh', 'resume']:
            root = PLAN['repository'] if step['name'] == 'bootstrap' else installed
            tail = ['bootstrap', PLAN['directory'], '', PLAN['artifact']['artifactId']] if step['name'] == 'bootstrap' else [step['name'], PLAN['directory'], PLAN['artifact']['sourceHead'] if step['name'] == 'refresh' else '', '']
            assert step['argv'] == [PLAN['node'], '--import', root + '/node_modules/tsx/dist/loader.mjs', root + '/tools/personal-preview/maintenance-host.mjs', *tail]
        if step['name'].startswith('facts-'):
            assert step['argv'] == [PLAN['node'], PLAN['factsCaller'], '--snapshot', PLAN['runDirectory'] + '/' + step['name'] + '.json']


def phase_budget(step, deadline):
    remaining = min(step['maximumWorkSeconds'], deadline - time.monotonic() - 7)
    assert remaining > 0, 'SHARED_DEADLINE_EXPIRED'
    return remaining


def execute(window, deadline):
    assert 0 < deadline - time.monotonic() <= 900, 'SHARED_DEADLINE_EXPIRED'
    inputs = bindings(); invocations()
    assert window.startswith('svc06-personal-7d1-')
    run = Path(PLAN['runDirectory']); assert not run.exists() and not run.is_symlink()
    usage = os.statvfs(PLAN['directory']); assert usage.f_bavail * usage.f_frsize >= PLAN['budget']['freshBytes']
    run.mkdir(mode=0o700)
    def save(name, value):
        fd = os.open(run / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
        parent = os.open(run, os.O_RDONLY | os.O_NOFOLLOW)
        try: os.fsync(parent)
        finally: os.close(parent)
    spec = importlib.util.spec_from_file_location('svc06_continuation_ops14', inputs['supervisor']['path'])
    ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
    env = {'PATH': str(Path(PLAN['node']).parent) + ':/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C', 'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}
    save('reservation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'window': window, 'planSha256': hashlib.sha256((BASE / 'maintenance-continuation.json').read_bytes()).hexdigest(), 'runIdentity': {'dev': str(run.stat().st_dev), 'ino': str(run.stat().st_ino)}, 'completedStagesNeverReplayed': True})
    save('maintenance-deadline.json', {'monotonicDeadline': deadline, 'seconds': 900, 'origin': 'Independent outer launch before bindings; not reset at bootstrap', 'innerFinishReserveSeconds': 5})
    completed = []; phase = 'before-first-observation'
    try:
        for step in PLAN['steps']:
            phase = step['name']
            usage = os.statvfs(PLAN['directory']); assert usage.f_bavail * usage.f_frsize >= PLAN['budget']['liveBytes']
            # Reserve room for one bounded capture plus two bounded observation documents.
            total = sum(path.stat().st_size for path in run.iterdir() if path.is_file())
            prior = sum(path.stat().st_size for path in (BASE / 'personal-actual-r2').rglob('*') if path.is_file())
            assert total + prior + 393216 <= PLAN['budget']['rawBytes']
            remaining = phase_budget(step, deadline)
            save(phase + '-invocation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), **step, 'remainingWorkSeconds': remaining})
            # fsync may consume time: never launch using the earlier saved allowance.
            remaining = phase_budget(step, deadline)
            report = ops.supervise(ops.Launch(tuple(step['argv']), step['cwd'], env, ops.Ownership.CHILD_PID_ONLY), ops.Policy(remaining, 0, 2, PLAN['budget']['perPhaseOutputBytes']))
            value = dict(vars(report)); value['stdout'] = report.stdout.decode('utf8', 'replace'); value['stderr'] = report.stderr.decode('utf8', 'replace')
            save(phase + '-outer.json', value)
            complete = report.exit_code == 0 and report.first_failure is None and report.owned_state == 'absent' and all(report.eof.values())
            print(json.dumps({'phase': phase, 'complete': complete, 'elapsedMs': report.elapsed_ms, 'owned': report.owned_state, 'eof': report.eof}), flush=True)
            assert complete, 'PHASE_UNCONFIRMED'
            assert time.monotonic() <= deadline, 'SHARED_DEADLINE_EXPIRED'
            completed.append(phase)
        save('result.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'outcome': 'RESUMED_AND_OBSERVED', 'completed': completed, 'providerQueries': 0})
    except BaseException as error:
        save('stop.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'outcome': 'STOP_KEEP_NO_RETRY', 'phase': phase, 'type': type(error).__name__, 'completed': completed, 'detachedServices': 'Only public maintenance may act; this caller performs no guessed kill/rollback', 'providerQueries': 0})
        raise


if __name__ == '__main__':
    if sys.argv[1:] == ['--check-invocations']:
        invocations(); print(json.dumps({'outcome': 'exact-arguments-validated', 'phases': len(PLAN['steps']), 'personalIO': 0}))
    elif len(sys.argv) == 4 and sys.argv[1] == '--supervised-entry':
        execute(sys.argv[2], float(sys.argv[3]))
    else:
        raise SystemExit('EXACT_INVOCATION_REQUIRED')
