"""Single-use DPERF05 pure parser check. Never runnable without separately pinned gate."""
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
    def reject_walk_error(error):
        raise error
    for directory, children, files in os.walk(root, followlinks=False, onerror=reject_walk_error):
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
    if binding['state'] != 'CANDIDATE_NOT_RUN':
        raise ValueError('SOURCE_BINDING_PENDING')
    gate = read_json(sys.argv[2])
    assert gate.get('allowRun') is True and gate.get('mode') == 'node-direct'
    assert gate['taskId'] == 'WPF-DPERF05' and gate['singleUse'] is True
    assert datetime.datetime.fromisoformat(gate['expiresAt'].replace('Z', '+00:00')) > datetime.datetime.now(datetime.timezone.utc)
    assert gate['bindingSha256'] == digest(BINDING)
    assert gate['runnerSha256'] == digest(__file__)
    assert gate['sandboxSha256'] == digest(PROFILE)
    assert gate['sourceHead'] == binding['head']
    assert gate['implementation'] == binding['implementation']
    assert gate['claim'] == binding['claim'] and gate['overlaps'] == []
    assert gate['previousRuntimeMs'] == binding['previousRuntimeMs'] == 0
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
            timeout=min(2, remaining), env=child_environment()).strip()
    assert git('rev-parse', 'HEAD') == binding['head']
    assert git('branch', '--show-current') == binding['branch']
    assert git('status', '--porcelain') == ''
    assert len(binding['sources']) == 2
    for filename, expected in {**binding['sources'], **binding['readOnlyDependencies']}.items():
        assert digest(root / filename) == expected, filename
    for filename, expected in binding['gitObjectDependencies'].items():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Setup exceeded work deadline')
        blob = subprocess.check_output(['git', 'show', binding['head'] + ':' + filename],
            cwd=root, timeout=min(2, remaining), env=child_environment())
        assert hashlib.sha256(blob).hexdigest() == expected, filename
    node = binding['node']
    assert str(Path(node['path']).resolve()) == node['realpath']
    assert digest(node['realpath']) == node['sha256']
    assert type(binding['expectedTestCount']) is int and binding['expectedTestCount'] > 0


def child_environment():
    # Keep only mundane process identity/path; no inherited credentials or loaders.
    env = {key: os.environ[key] for key in ('PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'CODEX_HOME')
           if key in os.environ}
    for name in ('TMPDIR', 'TMP', 'TEMP', 'XDG_CACHE_HOME', 'NODE_COMPILE_CACHE'):
        env[name] = str(SCRATCH)
    env.update({'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1',
                'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null',
                'GIT_OPTIONAL_LOCKS': '0', 'NO_COLOR': '1'})
    return env


def reap_owned(process, total_deadline):
    errors = []
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
    if time.monotonic() > total_deadline:
        errors.append('Total deadline exceeded during cleanup')
    return errors


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
    post_write = None
    report = {'startedAt': utc_now(), 'implementation': binding['implementation'],
              'sourceHead': binding['head'], 'sourceHashes': binding['sources'],
              'bindingSha256': digest(BINDING), 'runnerSha256': digest(__file__),
              'sandboxSha256': digest(PROFILE), 'limits': limits,
              'kind': 'one pure parser Node test file; no Git fixture, HTTP, PG, browser or network',
              'samples': samples, 'previousRuntimeMs': 0}
    # Atomic consumption prevents retries even when a later admission/source check fails.
    try:
        with (BASE / 'consumed-gate.json').open('x') as target:
            target.write(json.dumps(gate, indent=2) + '\n')
    except BaseException as error:
        selector.close()
        print(json.dumps({'state': 'FAIL_GATE_CONSUMPTION', 'error': str(error), 'childStarted': False}))
        return 2
    try:
        static_raw_bytes = sum(f.stat().st_size for f in BASE.glob('*.json'))
        log_limit = limits['rawBytes'] - static_raw_bytes - limits['finalReportReserveBytes']
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
        final_errors = []
        def capture(label, operation, fallback=None):
            try:
                return operation()
            except BaseException as error:
                final_errors.append(label + ': ' + type(error).__name__ + ': ' + str(error))
                return fallback
        # This is an early observation only; the authoritative tail sample follows reaping.
        final_used = capture('exit tmp observation', lambda: logical_bytes(BASE))
        report['observedTmpBytesBeforeReap'] = final_used
        if final_used is not None and final_used > limits['tmpBytes']:
            final_errors.append('Temporary size limit exceeded at child exit')
        capture('selector close', selector.close)
        cleanup_started = time.monotonic()
        cleanup_errors = capture('reap owned', lambda: reap_owned(process, total_deadline), ['cleanup raised'])
        if process and process.stdout:
            capture('stdout close', process.stdout.close)
        group_absent = capture('owned group observation', lambda: not group_alive(process), False)
        report['postReapBeforeRemoval'] = {'groupAbsent': group_absent}
        if group_absent:
            # Stable tail: no owned child may still append files before accounting.
            used = capture('post-reap tmp observation', lambda: logical_bytes(BASE))
            free = capture('post-reap free observation', lambda: available_bytes(binding['worktree']))
            report['postReapBeforeRemoval'].update(tmpBytes=used, freeBytes=free)
            if used is not None and used > limits['tmpBytes']:
                final_errors.append('Post-reap temporary size limit exceeded')
            if free is not None and free <= limits['stopFreeBytes']:
                final_errors.append('Post-reap free space below stop threshold')
            # Accounting failure is FAIL, but a reaped group's scratch is safe to remove.
            try:
                if SCRATCH.exists():
                    shutil.rmtree(SCRATCH)
            except BaseException as error:
                cleanup_errors.append('scratch cleanup: ' + str(error))
        else:
            cleanup_errors.append('Owned group remains or is unknown; scratch retained')
        scratch_absent = capture('scratch observation', lambda: not SCRATCH.exists(), False)
        if not scratch_absent:
            cleanup_errors.append('Owned scratch remains')
        report['cleanup'] = {'state': 'fulfilled' if not cleanup_errors else 'failed',
                             'errors': cleanup_errors, 'seconds': round(time.monotonic() - cleanup_started, 3),
                             'groupAbsent': group_absent, 'scratchAbsent': scratch_absent,
                             'basis': 'Only the owned sandbox/Node process group and own scratch; no service/database created'}
        report['exitCode'] = process.returncode if process else None
        report['logBytes'] = log_bytes
        report['droppedObservedLogBytes'] = dropped_bytes
        text = capture('read Node TAP log', lambda: LOG.read_text(errors='replace') if LOG.exists() else '', '')
        report['tap'] = {}
        for key in ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'):
            value = re.search(r'^# ' + key + r' (\d+)\s*$', text, re.MULTILINE)
            report['tap'][key] = int(value[1]) if value else None
        report['tap']['expectedTests'] = binding['expectedTestCount']
        report['finalFreeBytes'] = capture('final free observation', lambda: available_bytes(binding['worktree']))
        if report['finalFreeBytes'] is not None and report['finalFreeBytes'] <= limits['stopFreeBytes']:
            final_errors.append('Final free space below stop threshold')
        report['elapsedMs'] = round((time.monotonic() - started) * 1000)
        report['cumulativeMs'] = binding['previousRuntimeMs'] + report['elapsedMs']
        report['remainingMs'] = max(0, round(limits['totalSeconds'] * 1000) - report['elapsedMs'])
        report['finishedAt'] = utc_now()
        report['finalizationErrors'] = final_errors
        tap_okay = (report['tap']['tests'] == report['tap']['pass'] == binding['expectedTestCount']
                    and all(report['tap'][key] == 0 for key in ('fail', 'cancelled', 'skipped', 'todo')))
        okay = (not reason and report['exitCode'] == 0 and not cleanup_errors and not final_errors
                and report['elapsedMs'] <= limits['totalSeconds'] * 1000 and tap_okay and dropped_bytes == 0)
        report['state'] = 'PASS' if okay else ('FAIL' if cleanup_errors or final_errors else reason or 'FAIL')
        report['sourceMeaning'] = 'Pure parseStatus evidence only; no actual aggregate aging, deployment, registry, HTTP or browser proof.'
        encoded = (json.dumps(report, indent=2) + '\n').encode()
        tail_size = capture('final tmp quota', lambda: logical_bytes(BASE))
        raw_size = capture('final raw quota', lambda: sum(f.stat().st_size for f in BASE.glob('*.json')) + (LOG.stat().st_size if LOG.exists() else 0))
        if (tail_size is None or raw_size is None or len(encoded) > limits['finalReportReserveBytes']
                or tail_size + len(encoded) > limits['tmpBytes'] or raw_size + len(encoded) > limits['rawBytes']):
            final_errors.append('Final report or observed tmp/raw limit failure')
        if time.monotonic() > total_deadline:
            final_errors.append('Total deadline exceeded before report write')
        if final_errors:
            report['state'] = 'FAIL'
            encoded = (json.dumps(report, indent=2) + '\n').encode()
        if len(encoded) > limits['finalReportReserveBytes']:
            report = {'state': 'REPORT_LIMIT_FAILURE', 'cleanup': report['cleanup'],
                      'elapsedMs': report['elapsedMs'], 'logBytes': log_bytes,
                      'sourceHead': binding['head'], 'finalizationErrors': ['Report exceeded reserved bytes']}
            encoded = (json.dumps(report, indent=2) + '\n').encode()
        def check_written_result():
            # These actual observations are also returned on stdout after the final write.
            value = {'tmpBytes': logical_bytes(BASE),
                     'rawBytes': sum(f.stat().st_size for f in BASE.glob('*.json')) + (LOG.stat().st_size if LOG.exists() else 0),
                     'resultBytes': RESULT.stat().st_size}
            value['elapsedMs'] = (time.monotonic() - started) * 1000
            value['withinLimits'] = (value['tmpBytes'] <= limits['tmpBytes']
                                     and value['rawBytes'] <= limits['rawBytes']
                                     and value['resultBytes'] <= limits['finalReportReserveBytes']
                                     and value['elapsedMs'] <= limits['totalSeconds'] * 1000)
            return value
        try:
            RESULT.write_bytes(encoded)
            post_write = capture('post-write actual accounting', check_written_result)
            if post_write is None or not post_write['withinLimits']:
                final_errors.append('Post-write actual tmp/raw/report/time limit or observation failure')
                report['state'] = 'FAIL'
                report['postWriteFailure'] = post_write
                # At most one failure rewrite; never a reporting loop or a retry of tests.
                failure = (json.dumps(report, indent=2) + '\n').encode()
                if len(failure) > limits['finalReportReserveBytes']:
                    failure = (json.dumps({'state': 'FAIL', 'cleanup': report['cleanup'],
                        'finalizationErrors': ['Post-write accounting failure; report too large']}) + '\n').encode()
                RESULT.write_bytes(failure)
                post_write = capture('failure-report actual accounting', check_written_result)
        except BaseException as error:
            report['state'] = 'REPORT_WRITE_FAILURE'
            report['reportWriteError'] = type(error).__name__ + ': ' + str(error)
    print(json.dumps({'state': report['state'], 'result': str(RESULT), 'cleanup': report['cleanup'],
                      'postWrite': post_write, 'reportWriteError': report.get('reportWriteError')}))
    return 0 if report['state'] == 'PASS' else 1


if __name__ == '__main__':
    try:
        actual_binding, actual_gate = require_gate()
    except Exception as error:
        print(json.dumps({'state': 'NOT_RUN_PREFLIGHT', 'reason': str(error)}))
        sys.exit(2)
    sys.exit(run(actual_binding, actual_gate))
