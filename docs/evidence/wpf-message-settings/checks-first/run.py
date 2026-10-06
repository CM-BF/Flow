"""Single-use MessageSettings sequential noEmit/direct check. Never runnable without separately pinned gate."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent
BINDING = BASE / 'binding.json'
PROFILE = BASE / 'sandbox.sb'
SCRATCH = BASE / 'scratch'
RESULT = BASE / 'result.json'
LOG = BASE / 'node.log'


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read_json(path):
    return json.loads(Path(path).read_text())


def logical_bytes(root):
    """Count own files without traversing symlink targets."""
    total = 0
    for directory, children, files in os.walk(root, followlinks=False):
        children[:] = [name for name in children if not (Path(directory) / name).is_symlink()]
        for name in files:
            try:
                value = (Path(directory) / name).lstat()
            except FileNotFoundError:
                continue
            if stat.S_ISREG(value.st_mode):
                total += value.st_size
    return total


def available_bytes(path):
    value = os.statvfs(path)
    return value.f_bavail * value.f_frsize


def group_alive(process):
    if process is None:
        return False
    try:
        os.killpg(process.pid, 0)
        return True
    except ProcessLookupError:
        return False


def signal_group(process, sig):
    if process is not None:
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            pass


def require_gate():
    """Read-only rejection until reviewed binding and external gate both exist."""
    if len(sys.argv) != 3 or sys.argv[1] != '--gate':
        raise ValueError('An explicit external --gate path is required')
    binding = read_json(BINDING)
    if binding['state'] != 'REVIEWED_SOURCE_BOUND_NOT_RUN':
        raise ValueError('SOURCE_BINDING_PENDING')
    gate = read_json(sys.argv[2])
    assert gate.get('allowRun') is True and gate.get('mode') == 'types-and-direct'
    assert gate['taskId'] == 'WPF-MESSAGESETTINGS01' and gate['singleUse'] is True
    assert datetime.datetime.fromisoformat(gate['expiresAt'].replace('Z', '+00:00')) > datetime.datetime.now(datetime.timezone.utc)
    assert gate['bindingSha256'] == digest(BINDING)
    assert gate['runnerSha256'] == digest(__file__)
    assert gate['sandboxSha256'] == digest(PROFILE)
    assert gate['sourceHead'] == binding['head']
    assert gate['implementation'] == binding['implementation']
    assert gate['claim'] == binding['claim'] and gate['overlaps'] == []
    assert gate['previousRuntimeMs'] == binding['previousRuntimeMs'] == 0
    assert binding['limits']['totalSeconds'] == (30000 - binding['previousRuntimeMs']) / 1000
    assert binding['limits']['cleanupReserveSeconds'] == 5
    assert gate['limits'] == binding['limits']
    assert not SCRATCH.exists() and not RESULT.exists() and not LOG.exists()
    assert not (BASE / 'consumed-gate.json').exists(), 'This runner has already consumed its gate'
    return binding, gate


def verify_sources(binding, deadline):
    root = Path(binding['worktree'])
    def git(*args):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Setup exceeded work deadline')
        return subprocess.check_output(['git', *args], cwd=root, text=True,
            timeout=min(2, remaining), env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0',
            'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null'}).strip()
    assert git('rev-parse', 'HEAD') == binding['head']
    assert git('branch', '--show-current') == binding['branch']
    assert git('status', '--porcelain') == ''
    assert len(binding['sources']) == 6
    for filename, expected in {**binding['sources'], **binding['readOnlyDependencies']}.items():
        assert digest(root / filename) == expected, filename
    node = binding['node']
    assert str(Path(node['path']).resolve()) == node['realpath']
    assert digest(node['realpath']) == node['sha256']
    for item in binding['externalPins']:
        assert str(Path(item['path']).resolve()) == item['realpath'], item['path']
        assert digest(item['realpath']) == item['sha256'], item['path']
    for filename, expected in binding['preparedFiles'].items():
        assert digest(BASE / filename) == expected, filename
    assert type(binding['expectedTestCount']) is int and binding['expectedTestCount'] > 0


def child_environment():
    # Preserve HOME/home/CODEX_HOME. Redirect only this command's scratch/cache.
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(('FLOW_', 'PG', 'POSTGRES_', 'MESSAGESETTINGS_'))
           and key not in ('DATABASE_URL', 'NODE_OPTIONS', 'HTTP_PROXY', 'HTTPS_PROXY',
                           'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy')}
    for name in ('TMPDIR', 'TMP', 'TEMP', 'XDG_CACHE_HOME', 'NODE_COMPILE_CACHE'):
        env[name] = str(SCRATCH)
    env.update({'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1',
                'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null',
                'GIT_OPTIONAL_LOCKS': '0', 'NO_COLOR': '1', 'NO_PROXY': '127.0.0.1'})
    return env


def reap_owned(process, total_deadline, limits, worktree):
    errors = []
    terminal = {}
    try:
        signal_group(process, signal.SIGTERM)
        until = min(total_deadline - 2.5, time.monotonic() + 1.5)
        while group_alive(process) and time.monotonic() < until:
            if process:
                process.poll()
            time.sleep(0.025)
        if group_alive(process):
            signal_group(process, signal.SIGKILL)
        if process:
            process.wait(timeout=max(0.01, min(1.0, total_deadline - time.monotonic())))
        until = min(total_deadline - 1, time.monotonic() + 0.5)
        while group_alive(process) and time.monotonic() < until:
            time.sleep(0.025)
        if group_alive(process):
            errors.append('Owned process group remains')
    except Exception as error:
        errors.append('process cleanup: ' + str(error))
    # Child group has been reaped; inspect its final writes before removing scratch.
    try:
        terminal = {'freeBytes': available_bytes(worktree), 'tmpBytes': logical_bytes(BASE), 'afterReapBeforeRemove': True}
        if terminal['freeBytes'] <= limits['stopFreeBytes']:
            errors.append('Final resource stop threshold reached')
        if terminal['tmpBytes'] > limits['tmpBytes']:
            errors.append('Final temporary byte limit exceeded')
    except Exception as error:
        errors.append('final monitoring: ' + str(error))
    try:
        if SCRATCH.exists():
            shutil.rmtree(SCRATCH)
        if SCRATCH.exists():
            errors.append('Owned scratch remains')
    except Exception as error:
        errors.append('scratch cleanup: ' + str(error))
    if time.monotonic() > total_deadline:
        errors.append('Total deadline exceeded during cleanup')
    return errors, terminal


def run(binding, gate):
    limits = binding['limits']
    started = time.monotonic()
    work_deadline = started + limits['totalSeconds'] - limits['cleanupReserveSeconds']
    total_deadline = started + limits['totalSeconds']
    process = None
    reason = None
    samples = []
    log_bytes = 0
    dropped_bytes = 0
    selector = selectors.DefaultSelector()
    report = {'startedAt': utc_now(), 'implementation': binding['implementation'],
              'sourceHead': binding['head'], 'sourceHashes': binding['sources'],
              'bindingSha256': digest(BINDING), 'runnerSha256': digest(__file__),
              'sandboxSha256': digest(PROFILE), 'limits': limits,
              'kind': 'one strict noEmit then two direct files/one fork; own loopback HTTP fixtures; no PG/browser/external network',
              'samples': samples, 'previousRuntimeMs': binding['previousRuntimeMs']}
    # Atomic consumption prevents retries even when a later admission/source check fails.
    with (BASE / 'consumed-gate.json').open('x') as target:
        target.write(json.dumps(gate, indent=2) + '\n')
    static_raw_bytes = logical_bytes(BASE)
    log_limit = limits['rawBytes'] - static_raw_bytes - limits['finalReportReserveBytes'] - limits['structuredReportBytes']
    try:
        assert log_limit > 0
        verify_sources(binding, work_deadline)
        report['initialFreeBytes'] = available_bytes(binding['worktree'])
        if report['initialFreeBytes'] < limits['startFreeBytes']:
            reason = 'NOT_RUN_RESOURCE'
        elif time.monotonic() >= work_deadline:
            reason = 'NOT_RUN_SETUP_DEADLINE'
        else:
            SCRATCH.mkdir(mode=0o700)
            command = ['/usr/bin/sandbox-exec', '-f', str(PROFILE), binding['node']['path'], *binding['commandArgs']]
            report['command'] = command
            with LOG.open('xb') as output:
                process = subprocess.Popen(command, cwd=binding['worktree'], env=child_environment(),
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
                report['pgid'] = process.pid
                os.set_blocking(process.stdout.fileno(), False)
                selector.register(process.stdout, selectors.EVENT_READ)
                next_sample = 0
                while True:
                    current = time.monotonic()
                    if current >= next_sample:
                        free = available_bytes(binding['worktree'])
                        used = logical_bytes(BASE)
                        samples.append({'seconds': round(current - started, 3), 'freeBytes': free, 'tmpBytes': used})
                        next_sample = current + limits['pollSeconds']
                        if free <= limits['stopFreeBytes']:
                            reason = 'RESOURCE_STOP'
                        if used > limits['tmpBytes']:
                            reason = 'TMP_LIMIT_STOP'
                    if current >= work_deadline:
                        reason = 'WORK_DEADLINE_STOP'
                    if reason:
                        break
                    for key, _ in selector.select(max(0, min(limits['pollSeconds'], work_deadline - time.monotonic()))):
                        chunk = os.read(key.fileobj.fileno(), 65536)
                        if not chunk:
                            selector.unregister(key.fileobj)
                            continue
                        keep = min(len(chunk), max(0, log_limit - log_bytes))
                        output.write(chunk[:keep]); output.flush(); log_bytes += keep
                        if keep < len(chunk):
                            dropped_bytes += len(chunk) - keep
                            reason = 'RAW_LIMIT_STOP'
                            break
                    if reason or (process.poll() is not None and not selector.get_map()):
                        break
    except BaseException as error:
        reason = 'SUPERVISION_ERROR'
        report['error'] = type(error).__name__ + ': ' + str(error)
    finally:
        selector.close()
        # Inspect all evidence before removing own scratch; failures still reach cleanup/report.
        captured = {}
        capture_errors = []
        try:
            last_free = available_bytes(binding['worktree'])
            last_size = logical_bytes(BASE)
            samples.append({'seconds': round(time.monotonic() - started, 3), 'freeBytes': last_free, 'tmpBytes': last_size, 'terminal': True})
            if last_free <= limits['stopFreeBytes']:
                reason = reason or 'RESOURCE_STOP'
            if last_size > limits['tmpBytes']:
                reason = reason or 'TMP_LIMIT_STOP'
            pending_bytes = {}
            for filename in ('step-results.json', 'vitest-results.json'):
                source = SCRATCH / filename
                if not source.is_file() or source.is_symlink():
                    capture_errors.append(filename + ': missing or symlink')
                    continue
                if source.stat().st_size > limits['structuredReportBytes']:
                    capture_errors.append(filename + ': too large')
                    continue
                value = source.read_bytes()
                parsed = json.loads(value)
                if filename == 'step-results.json':
                    if not isinstance(parsed, list) or any(not isinstance(item, dict) for item in parsed):
                        raise ValueError('step-results must be an array of objects')
                elif not isinstance(parsed, dict):
                    raise ValueError('vitest-results must be an object')
                pending_bytes[filename] = value
                captured[filename] = parsed
            if sum(len(value) for value in pending_bytes.values()) > limits['structuredReportBytes']:
                raise ValueError('Combined structured reports too large')
            for filename, value in pending_bytes.items():
                (BASE / filename).write_bytes(value)
        except Exception as error:
            capture_errors.append(type(error).__name__ + ': ' + str(error))
        report['captureErrors'] = capture_errors
        report['steps'] = captured.get('step-results.json')
        direct = captured.get('vitest-results.json', {})
        report['direct'] = {key: direct.get(key) for key in ('success', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests')}
        cleanup_started = time.monotonic()
        cleanup_errors, terminal_sample = reap_owned(process, total_deadline, limits, binding['worktree'])
        if terminal_sample:
            samples.append({'seconds': round(time.monotonic() - started, 3), **terminal_sample})
        if process and process.stdout:
            process.stdout.close()
        report['cleanup'] = {'state': 'fulfilled' if not cleanup_errors else 'failed',
                             'errors': cleanup_errors, 'seconds': round(time.monotonic() - cleanup_started, 3),
                             'groupAbsent': not group_alive(process), 'scratchAbsent': not SCRATCH.exists(),
                             'serverClosureBasis': 'Both sequential commands and their fork/own HTTP fixture remain in the inherited worker group; no external service used'}
        report['exitCode'] = process.returncode if process else None
        report['logBytes'] = log_bytes
        report['droppedObservedLogBytes'] = dropped_bytes
        report['elapsedMs'] = round((time.monotonic() - started) * 1000)
        report['cumulativeMs'] = binding['previousRuntimeMs'] + report['elapsedMs']
        report['remainingMs'] = max(0, 30000 - report['cumulativeMs'])
        report['finishedAt'] = utc_now()
        expected_steps = report.get('steps') or []
        steps_passed = (len(expected_steps) == 2 and [s.get('name') for s in expected_steps] == ['strict-noEmit', 'direct']
                        and all(s.get('exitCode') == 0 and not s.get('signal') and not s.get('error') for s in expected_steps))
        direct_passed = (direct.get('success') is True and direct.get('numTotalTests') == binding['expectedTestCount']
                         and direct.get('numPassedTests') == binding['expectedTestCount'] and direct.get('numFailedTests') == 0
                         and direct.get('numPendingTests') == 0 and direct.get('numTodoTests', 0) == 0)
        okay = (not reason and report['exitCode'] == 0 and not cleanup_errors and not capture_errors
                and report['elapsedMs'] <= round(limits['totalSeconds'] * 1000) and report['cumulativeMs'] <= 30000
                and steps_passed and direct_passed and dropped_bytes == 0)
        report['state'] = 'PASS' if okay else reason or 'FAIL'
        report['sourceMeaning'] = 'Focused noEmit/direct cover these frozen leaf/legacy modules only, not rendered picker, App/Recovery mounting or provider behavior.'
        encoded = (json.dumps(report, indent=2) + '\n').encode()
        try:
            retained_bytes = logical_bytes(BASE)
        except Exception as error:
            retained_bytes = limits['rawBytes'] + 1
            report['retainedBudgetError'] = str(error)
        if len(encoded) > limits['finalReportReserveBytes'] or retained_bytes + len(encoded) > limits['rawBytes']:
            report = {'state': 'REPORT_LIMIT_FAILURE', 'cleanup': report['cleanup'],
                      'elapsedMs': report['elapsedMs'], 'logBytes': log_bytes,
                      'fullReportBytes': len(encoded), 'sourceHead': binding['head'],
                      'previousRuntimeMs': report['previousRuntimeMs'],
                      'cumulativeMs': report['cumulativeMs'], 'remainingMs': report['remainingMs']}
            encoded = (json.dumps(report, indent=2) + '\n').encode()
        RESULT.write_bytes(encoded)
    print(json.dumps({'state': report['state'], 'result': str(RESULT), 'cleanup': report['cleanup']}))
    return 0 if report['state'] == 'PASS' else 1


if __name__ == '__main__':
    try:
        actual_binding, actual_gate = require_gate()
    except Exception as error:
        print(json.dumps({'state': 'NOT_RUN_PREFLIGHT', 'reason': str(error)}))
        sys.exit(2)
    sys.exit(run(actual_binding, actual_gate))
