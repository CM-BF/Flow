"""Prepared single-use quick-controls noEmit/direct packet; no execution without external fresh gate.
Adapted from the reviewed message-settings-once runner and DPERF terminal-stop cleanup method.
"""
import datetime
import errno
import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent
SCRATCH = BASE / 'scratch'
BINDING = BASE / 'binding.json'
PROFILE = BASE / 'sandbox.sb'
TOTAL_MS = 30000
TERMINAL_CONTRACT = 'msgquick-terminal-v1-external-exit-required'
MiB = 1024 * 1024


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def load(path):
    p = Path(path)
    if p.is_symlink() or not p.is_file() or p.stat().st_size > MiB:
        raise ValueError('Invalid bounded JSON input: ' + str(p))
    return json.loads(p.read_text())


def save(path, value):
    encoded = (json.dumps(value, indent=2) + '\n').encode()
    if len(encoded) > 65536:
        raise ValueError('Parent JSON report exceeds its 64 KiB reserve')
    Path(path).write_bytes(encoded)


def scan_error(error):
    if error.errno != errno.ENOENT:
        raise error


def sizes(root, exclude=None):
    """Observe only owned files, never follow symlink targets; only transient ENOENT is ignored."""
    logical = allocated = 0
    for directory, children, files in os.walk(root, followlinks=False, onerror=scan_error):
        children[:] = [n for n in children if not (Path(directory)/n).is_symlink()
                       and (exclude is None or Path(directory)/n != exclude)]
        for name in files:
            try:
                value = (Path(directory)/name).lstat()
            except FileNotFoundError:
                continue
            if stat.S_ISREG(value.st_mode):
                logical += value.st_size
                allocated += value.st_blocks * 512
    return logical, allocated


def free(path):
    value = os.statvfs(path)
    return value.f_bavail * value.f_frsize


def alive(process):
    if process is None:
        return False
    try:
        os.killpg(process.pid, 0)
        return True
    except ProcessLookupError:
        return False


def stop(process, sig):
    if process is not None:
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            pass


def require_gate():
    if len(sys.argv) != 3 or sys.argv[1] != '--gate':
        raise ValueError('Explicit reviewed external --gate required')
    binding = load(BINDING)
    assert binding['state'] == 'REVIEWED_SOURCE_BOUND_NOT_RUN', 'PREPARED refuses execution'
    gate = load(sys.argv[2])
    assert gate['allowRun'] is True and gate['singleUse'] is True
    assert gate['taskId'] == binding['task'] == 'WPF-MESSAGESETTINGS02'
    assert gate['mode'] == 'types-and-direct'
    assert datetime.datetime.fromisoformat(gate['expiresAt'].replace('Z', '+00:00')) > datetime.datetime.now(datetime.timezone.utc)
    assert gate['bindingSha256'] == sha(BINDING) and gate['runnerSha256'] == sha(__file__)
    assert gate['sandboxSha256'] == sha(PROFILE)
    assert gate['sourceHead'] == binding['head'] and gate['implementation'] == binding['implementation']
    assert gate['claim'] == binding['claim'] and gate['overlaps'] == []
    assert gate['previousRuntimeMs'] == binding['previousRuntimeMs'] == 0
    assert gate['limits'] == binding['limits']
    assert binding['limits']['totalSeconds'] == 30 and binding['limits']['cleanupReserveSeconds'] == 5
    assert binding['limits']['startFreeBytes'] == 1090519040 and binding['limits']['stopFreeBytes'] == 1082130432
    assert binding['limits']['tmpBytes'] == 8*MiB and binding['limits']['rawBytes'] == 2*MiB
    assert binding['expectedTestCount'] == 26
    assert binding['terminalAcceptance']['contract'] == TERMINAL_CONTRACT
    assert binding['terminalAcceptance']['externalActualExitCode'] == 0
    for name in ('scratch', 'consumed-gate.json', 'result.json', 'budget.json', 'node.log'):
        assert not (BASE/name).exists(), 'Already used or conflicting run: ' + name
    return binding, gate


def child_environment(work_deadline_ms):
    # Keep HOME unchanged. No credential file is read and no environment values are recorded.
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(('FLOW_', 'PG', 'POSTGRES_', 'MESSAGESETTINGS_', 'MSGQUICK_'))
           and k not in ('DATABASE_URL', 'NODE_OPTIONS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
                        'http_proxy', 'https_proxy', 'all_proxy')}
    for key in ('TMPDIR', 'TMP', 'TEMP', 'XDG_CACHE_HOME', 'NODE_COMPILE_CACHE'):
        env[key] = str(SCRATCH)
    env.update(NODE_DISABLE_COMPILE_CACHE='1', TSX_DISABLE_CACHE='1', NO_COLOR='1', NO_PROXY='127.0.0.1',
               GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_SYSTEM='/dev/null', GIT_OPTIONAL_LOCKS='0',
               MSGQUICK_WORK_DEADLINE_MS=str(work_deadline_ms))
    return env


def run(binding, gate):
    started = time.monotonic()
    wall_ms = int(time.time()*1000)
    limits = binding['limits']
    hard = started + limits['totalSeconds']
    work = hard - limits['cleanupReserveSeconds']
    root = Path(binding['worktree'])
    errors, cleanup, samples = [], [], []
    process = None
    output = None
    stopping = False
    selector = selectors.DefaultSelector()
    stream = {'receivedBytes': 0, 'keptBytes': 0, 'droppedBytes': 0, 'eof': False}
    report = {'state': 'FAILED', 'task': binding['task'], 'startedAt': now(), 'sourceHead': binding['head'],
              'implementation': binding['implementation'], 'sourceHashes': binding['sources'],
              'bindingSha256': sha(BINDING), 'runnerSha256': sha(__file__), 'sandboxSha256': sha(PROFILE),
              'terminalContract': TERMINAL_CONTRACT,
              'completionBoundary': 'Final owned-cleanup/resource/result seal before restoring cooperative handlers; disk state remains a candidate until external exit receipt',
              'limits': limits, 'samples': samples, 'errors': errors, 'previousRuntimeMs': binding['previousRuntimeMs'],
              'meaning': 'Targeted strict noEmit then one direct test file; real helper/HTTP fixture, no rendered UI/App/provider coverage'}
    def request_stop(sig, frame):
        nonlocal stopping
        stopping = True
        report['state'] = 'FAILED'
        if 'stopSignal' not in report:
            report['stopSignal'] = signal.Signals(sig).name
            errors.append('Cooperative stop: '+report['stopSignal'])
    handlers = {sig: signal.signal(sig, request_stop) for sig in (signal.SIGTERM, signal.SIGINT)}
    def observe(phase):
        available = free(root)
        temporary = sizes(SCRATCH)
        retained = sizes(BASE, exclude=SCRATCH)[0]
        samples.append({'phase': phase, 'ms': round((time.monotonic()-started)*1000), 'freeBytes': available,
                        'scratchLogicalBytes': temporary[0], 'scratchAllocatedBytes': temporary[1], 'retainedBytes': retained})
        if available <= limits['stopFreeBytes']:
            raise RuntimeError('Free-space stop threshold reached')
        if max(temporary) > limits['tmpBytes']:
            raise RuntimeError('Observed scratch limit exceeded')
        if retained > limits['rawBytes'] - 128*1024:
            raise RuntimeError('Retained raw reserve exhausted')
        return available
    def checkpoint():
        if stopping or time.monotonic() >= work:
            raise TimeoutError('Stop/work deadline; reserved cleanup begins')
        observe('work')
    def git(*args):
        checkpoint()
        return subprocess.check_output(['git', *args], cwd=root, text=True, timeout=min(2, max(.01, work-time.monotonic())),
            env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null'}).strip()
    def pump(timeout):
        for key, _ in selector.select(max(0, timeout)):
            chunk = os.read(key.fileobj.fileno(), 65536)
            if not chunk:
                selector.unregister(key.fileobj)
                stream['eof'] = True
                key.fileobj.close()
                continue
            keep = min(len(chunk), max(0, MiB-stream['keptBytes']))
            output.write(chunk[:keep]); output.flush()
            stream['receivedBytes'] += len(chunk)
            stream['keptBytes'] += keep
            stream['droppedBytes'] += len(chunk)-keep
            if keep != len(chunk) and 'Captured log limit exceeded' not in errors:
                errors.append('Captured log limit exceeded')
        if process is not None:
            process.poll()
    def persist():
        elapsed = round((time.monotonic()-started)*1000)
        cumulative = binding['previousRuntimeMs'] + elapsed
        if cumulative > TOTAL_MS and 'Total allowance exceeded' not in errors:
            errors.append('Total allowance exceeded')
        report.update(elapsedMs=elapsed, cumulativeMs=cumulative, remainingMs=max(0, TOTAL_MS-cumulative),
            state='PASS' if not stopping and not errors and not cleanup and process is not None and process.returncode == 0 else 'FAILED',
            finishedAt=now())
        save(BASE/'result.json', report)
        save(BASE/'budget.json', {'complete': not cleanup, 'state': report['state'], 'spentMs': cumulative,
            'limitMs': TOTAL_MS, 'cleanupReserveMs': 5000, 'stopSignal': report.get('stopSignal'),
            'terminalContract': TERMINAL_CONTRACT, 'result': str(BASE/'result.json')})
    try:
        try:
            with (BASE/'consumed-gate.json').open('x') as sink:
                json.dump(gate, sink, indent=2)
            save(BASE/'budget.json', {'complete': False, 'spentMs': binding['previousRuntimeMs'], 'limitMs': TOTAL_MS})
            assert root.resolve() == root
            report['initialFreeBytes'] = observe('initial')
            assert report['initialFreeBytes'] >= limits['startFreeBytes'], 'NOT_RUN_RESOURCE'
            assert git('rev-parse', 'HEAD') == binding['head'] and git('branch', '--show-current') == binding['branch']
            assert git('status', '--porcelain') == ''
            assert len(binding['sources']) == 4
            own = dict(binding['readOnlyDependencies'])
            for name, digest in binding['sources'].items():
                assert name not in own or own[name] == digest, 'Conflicting duplicate source pin: '+name
                own[name] = digest
            for name, digest in own.items():
                checkpoint(); assert sha(root/name) == digest, name
            for item in [binding['node'], *binding['externalPins']]:
                checkpoint(); assert str(Path(item['path']).resolve()) == item['realpath']
                assert sha(item['realpath']) == item['sha256'], item['path']
            for name, digest in binding['preparedFiles'].items():
                checkpoint(); assert sha(BASE/name) == digest, name
            expected = load(BASE/'expected-tests.json')
            assert expected['count'] == len(expected['names']) == binding['expectedTestCount']
            checkpoint(); SCRATCH.mkdir(mode=0o700)
            command = ['/usr/bin/sandbox-exec', '-f', str(PROFILE), binding['node']['path'], *binding['commandArgs']]
            report['command'] = command
            output = (BASE/'node.log').open('xb')
            checkpoint()
            process = subprocess.Popen(command, cwd=root, env=child_environment(wall_ms+25000), stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
            report['pgid'] = process.pid
            os.set_blocking(process.stdout.fileno(), False)
            selector.register(process.stdout, selectors.EVENT_READ)
            while True:
                checkpoint(); pump(min(.25, max(0, work-time.monotonic())))
                if errors:
                    raise RuntimeError('Captured process error')
                if process.poll() is not None and stream['eof']:
                    break
        except BaseException as error:
            errors.append(type(error).__name__+': '+str(error))
        finally:
            # No work checkpoint here: cleanup and last-byte observations also run after timeout/soft-stop.
            try:
                stop(process, signal.SIGTERM)
                until = min(hard-3, time.monotonic()+1)
                while alive(process) and time.monotonic() < until:
                    pump(.025)
                if alive(process):
                    stop(process, signal.SIGKILL)
                if process:
                    process.wait(timeout=max(.01, min(1, hard-time.monotonic()-2)))
                until = min(hard-1.5, time.monotonic()+.5)
                while (alive(process) or selector.get_map()) and time.monotonic() < until:
                    pump(.025)
            except BaseException as error:
                cleanup.append('Owned group reap/drain: '+str(error))
            group_absent = not alive(process)
            if not group_absent:
                cleanup.append('Owned process group remains; scratch retained')
            if process is not None and not stream['eof']:
                cleanup.append('Captured output did not reach EOF')
            for key in list(selector.get_map().values()):
                try:
                    selector.unregister(key.fileobj); key.fileobj.close()
                except BaseException as error:
                    cleanup.append('Pipe close: '+str(error))
            selector.close()
            if output is not None:
                try:
                    output.close()
                except BaseException as error:
                    cleanup.append('Log close: '+str(error))
            if group_absent:
                try:
                    observe('after-reap-before-scratch-removal')
                except BaseException as error:
                    errors.append('Terminal observation: '+str(error))
                try:
                    captured = {}
                    total = 0
                    for filename in ('step-results.json', 'vitest-results.json'):
                        path = SCRATCH/filename
                        assert path.is_file() and not path.is_symlink(), filename
                        total += path.stat().st_size
                        assert total <= limits['structuredReportBytes'], 'Combined structured reports too large'
                        raw = path.read_bytes(); captured[filename] = json.loads(raw)
                        (BASE/filename).write_bytes(raw)
                    steps = captured['step-results.json']; direct = captured['vitest-results.json']
                    report['steps'] = steps
                    report['direct'] = {k: direct.get(k) for k in ('success', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests')}
                    assert len(steps) == 2 and [s['name'] for s in steps] == ['strict-noEmit', 'direct']
                    assert all(s['exitCode'] == 0 and not s.get('signal') and not s.get('error') for s in steps)
                    assert direct.get('success') is True and direct.get('numTotalTests') == direct.get('numPassedTests') == binding['expectedTestCount']
                    assert direct.get('numFailedTests') == direct.get('numPendingTests') == direct.get('numTodoTests', 0) == 0
                    assertions = [a for file in direct['testResults'] for a in file['assertionResults']]
                    assert len(direct['testResults']) == 1 and all(a['status'] == 'passed' for a in assertions)
                    assert sorted(a['title'] for a in assertions) == sorted(load(BASE/'expected-tests.json')['names'])
                    report['matchedTestNames'] = len(assertions)
                except BaseException as error:
                    errors.append('Structured result validation: '+str(error))
                try:
                    if SCRATCH.exists():
                        shutil.rmtree(SCRATCH)
                except BaseException as error:
                    cleanup.append('Scratch removal: '+str(error))
            if SCRATCH.exists():
                cleanup.append('Owned scratch remains')
            report.update(exitCode=process.returncode if process else None, logStream=stream,
                cleanup={'errors': cleanup, 'groupAbsent': group_absent, 'scratchAbsent': not SCRATCH.exists()})
            if time.monotonic() > hard:
                errors.append('Total deadline exceeded during cleanup')
            persist()
            try:
                observe('after-result-and-budget-write')
            except BaseException as error:
                errors.append('Post-write observation: '+str(error))
            persist()
            report['afterResultBudgetWritesElapsedMs'] = round((time.monotonic()-started)*1000)
            report['finalTimingMeaning'] = 'Observed after preceding result/budget writes; final bounded serialization follows.'
            try:
                assert sizes(BASE, exclude=SCRATCH)[0] <= limits['rawBytes'], 'Final retained cap exceeded'
                assert time.monotonic() <= hard, 'Total deadline includes terminal writes'
            except BaseException as error:
                errors.append('Final record completion: '+str(error))
            persist()
            if stopping:
                persist()
    finally:
        for sig, previous in handlers.items():
            signal.signal(sig, previous)
    if stopping:
        persist()
    # Cooperative handling ends at restoration above. This seal is only a candidate, not an exit receipt.
    # Any later interruption, missing stdout, changed seal or nonzero actual outer exit invalidates disk PASS.
    declared_exit = 0 if not stopping and not errors and not cleanup and report['state'] == 'PASS' else 1
    print(json.dumps({'type': 'terminal-seal', 'terminalContract': TERMINAL_CONTRACT,
        'state': 'PASS' if declared_exit == 0 else 'FAILED', 'declaredExitCode': declared_exit,
        'bindingSha256': sha(BINDING), 'result': str(BASE/'result.json'),
        'resultSha256': sha(BASE/'result.json'), 'budgetSha256': sha(BASE/'budget.json'),
        'stepResultsSha256': sha(BASE/'step-results.json') if (BASE/'step-results.json').is_file() else None,
        'cleanup': report.get('cleanup'), 'stopping': stopping, 'stopSignal': report.get('stopSignal'),
        'afterFinalWritesElapsedMs': round((time.monotonic()-started)*1000)}), flush=True)
    return declared_exit


if __name__ == '__main__':
    try:
        binding, gate = require_gate()
    except Exception as error:
        print(json.dumps({'state': 'NOT_RUN_PREFLIGHT', 'reason': str(error)}), flush=True)
        sys.exit(2)
    try:
        actual_exit = run(binding, gate)
    except BaseException as error:
        print(json.dumps({'state': 'FAILED_TERMINAL_REPORT', 'actualExitCode': 1,
                          'reason': type(error).__name__+': '+str(error)}), flush=True)
        actual_exit = 1
    sys.exit(actual_exit)
