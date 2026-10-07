"""One-shot owned-only observation of killpg(0), WNOWAIT, and reap ordering.

No positive group signal is used. The data do not reinterpret EPERM as absence.
"""
import dataclasses
import datetime
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import select
import shutil
import signal
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'


def group_observation(pgid):
    try:
        os.killpg(pgid, 0)
        return {'result': 'success', 'errno': None}
    except OSError as error:
        return {'result': 'error', 'errno': error.errno, 'type': type(error).__name__}


def wait_bytes(fd, maximum, deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0 or not select.select([fd], [], [], remaining)[0]:
        raise TimeoutError('OWNED_PIPE_DEADLINE')
    return os.read(fd, maximum)


def observed_exit(pid, deadline):
    while time.monotonic() < deadline:
        value = os.waitid(os.P_PID, pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if value is not None:
            return {'pid': value.si_pid, 'code': value.si_code, 'status': value.si_status}
        time.sleep(0.005)
    raise TimeoutError('OWNED_EXIT_DEADLINE')


def stop_on_alarm(_signal, _frame):
    os._exit(124)


def leader(controls, with_descendant):
    command_r, command_w, descendant_r, descendant_w, ready_r, ready_w, ack_r, ack_w = controls
    os.close(command_w); os.close(descendant_w); os.close(ready_r); os.close(ack_r)
    os.setsid()
    signal.signal(signal.SIGALRM, stop_on_alarm)
    signal.setitimer(signal.ITIMER_REAL, 4)
    descendant = os.fork() if with_descendant else None
    if descendant == 0:
        signal.setitimer(signal.ITIMER_REAL, 4)
        os.close(command_r); os.close(ready_w)
        os.write(ack_w, b'R')
        while True:
            command = os.read(descendant_r, 1)
            if command != b'P':
                os._exit(0)
            os.write(ack_w, b'P')
    os.close(descendant_r); os.close(ack_w)
    os.write(ready_w, (json.dumps({'pid': os.getpid(), 'pgid': os.getpgrp(),
                                'sid': os.getsid(0), 'descendant': descendant}) + '\n').encode())
    os.close(ready_w)
    os.read(command_r, 1)
    os._exit(0)


def observe_case(with_descendant):
    controls = (*os.pipe(), *os.pipe(), *os.pipe(), *os.pipe())
    command_r, command_w, descendant_r, descendant_w, ready_r, ready_w, ack_r, ack_w = controls
    pid = os.fork()
    if pid == 0:
        try:
            leader(controls, with_descendant)
        finally:
            os._exit(125)
    for fd in (command_r, descendant_r, ready_w, ack_w):
        os.close(fd)
    report = {'case': 'live-descendant' if with_descendant else 'leader-only',
              'ownedLeader': pid, 'stages': [], 'primaryFailure': None, 'cleanup': {'leaderReaped': False}}
    open_fds = {command_w, descendant_w, ready_r, ack_r}
    try:
        ready = json.loads(wait_bytes(ready_r, 1024, time.monotonic() + 0.75))
        if ready['pid'] != pid or ready['pgid'] != pid or ready['sid'] != pid:
            raise ValueError('OWNED_GROUP_IDENTITY_MISMATCH')
        report['ready'] = ready
        if with_descendant:
            if wait_bytes(ack_r, 1, time.monotonic() + 0.75) != b'R' or os.getpgid(ready['descendant']) != pid:
                raise ValueError('OWNED_DESCENDANT_IDENTITY_MISMATCH')

        def stage(name, wait_fact):
            item = {'name': name, 'waitid': wait_fact, 'killpg0': group_observation(pid)}
            if with_descendant:
                os.write(descendant_w, b'P')
                item['descendantAcknowledged'] = wait_bytes(ack_r, 1, time.monotonic() + 0.5) == b'P'
                if not item['descendantAcknowledged']:
                    raise ValueError('OWNED_DESCENDANT_NOT_LIVE')
            report['stages'].append(item)

        value = os.waitid(os.P_PID, pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        if value is not None:
            raise ValueError('LEADER_EXITED_BEFORE_RELEASE')
        stage('live', None)
        os.write(command_w, b'X')
        fact = observed_exit(pid, time.monotonic() + 0.75)
        stage('exited-unreaped', fact)
        waited, status = os.waitpid(pid, os.WNOHANG)
        if waited != pid:
            raise ValueError('OWNED_REAP_NOT_READY')
        report['cleanup'].update(leaderReaped=True, waitStatus=status)
        stage('reaped', 'reaped-own-child')
    except Exception as error:
        report['primaryFailure'] = {'type': type(error).__name__, 'errno': getattr(error, 'errno', None)}
    finally:
        # Controlled pipes stop the tiny descendant without signaling a reaped PGID.
        for fd in (command_w, descendant_w):
            try:
                os.write(fd, b'X')
            except OSError:
                pass
            os.close(fd); open_fds.remove(fd)
        if not report['cleanup']['leaderReaped']:
            try:
                observed_exit(pid, time.monotonic() + 0.5)
                waited, status = os.waitpid(pid, os.WNOHANG)
                report['cleanup'].update(leaderReaped=waited == pid, waitStatus=status)
            except Exception as error:
                # Preserve uncertainty. The tiny child has its own four-second alarm.
                report['cleanup']['error'] = {'type': type(error).__name__, 'errno': getattr(error, 'errno', None)}
        if with_descendant:
            try:
                report['cleanup']['descendantPipeEOF'] = wait_bytes(ack_r, 1, time.monotonic() + 0.5) == b''
            except Exception as error:
                report['cleanup']['descendantError'] = {'type': type(error).__name__, 'errno': getattr(error, 'errno', None)}
        for fd in open_fds:
            os.close(fd)
        observations = []
        for _ in range(5):
            observations.append(group_observation(pid))
            if observations[-1]['errno'] == errno.ESRCH:
                break
            time.sleep(0.02)
        report['cleanup']['groupAfter'] = observations[-1]
        report['cleanup']['observations'] = observations
    return report


def probe():
    # Independent process deadline also covers stdout serialization/write, without fsync first.
    signal.signal(signal.SIGALRM, stop_on_alarm)
    signal.setitimer(signal.ITIMER_REAL, 7)
    result = {'system': {key: getattr(os.uname(), key) for key in ('sysname', 'release', 'version', 'machine')},
              'cases': [observe_case(False), observe_case(True)],
              'limits': 'No inference from EPERM to absent; no observation of preexisting groups; no positive group signals.'}
    raw = (json.dumps(result, indent=2) + '\n').encode()
    if len(raw) > 16384:
        os._exit(126)
    os.write(1, raw)
    complete = all(not case['primaryFailure'] and case['cleanup']['leaderReaped']
                   and case['cleanup']['groupAfter']['errno'] == errno.ESRCH
                   and case['cleanup'].get('descendantPipeEOF', True) for case in result['cases'])
    os._exit(0 if complete else 1)


def write_record(path, data, maximum):
    if len(data) > maximum:
        raise ValueError('RECORD_BYTE_LIMIT')
    with path.open('xb') as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())


def run():
    # Parent deadline includes reservation/result writes; it never waits for a checkpoint to exit.
    signal.signal(signal.SIGALRM, stop_on_alarm)
    signal.setitimer(signal.ITIMER_REAL, 9.5)
    free = shutil.disk_usage(ROOT).free
    if free < 1077936128:
        raise RuntimeError('RESOURCE_NOT_ADMITTED')
    output = HERE / 'zombie-probe-reservation.json'
    reservation = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'freeBytes': free,
                   'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                   'supervisorSha256': hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest(),
                   'provider': 0, 'PG': 0, 'preexistingProcesses': 0, 'state': 'reserved-one-shot'}
    write_record(output, (json.dumps(reservation, indent=2) + '\n').encode(), 4096)
    spec = importlib.util.spec_from_file_location('ops14_probe_supervisor', SUPERVISOR)
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    report = module.supervise(module.Launch((sys.executable, '-B', __file__, '--probe'), str(ROOT),
                              {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1'}, module.Ownership.CHILD_PID_ONLY),
                              module.Policy(8, 0, 1, 32768))
    value = dataclasses.asdict(report)
    cases = []
    try:
        observed = json.loads(report.stdout)
        cases = observed['cases']
        case_complete = len(cases) == 2 and all(
            case['primaryFailure'] is None and len(case['stages']) == 3
            and case['cleanup']['leaderReaped'] is True
            and case['cleanup']['groupAfter']['errno'] == errno.ESRCH
            and case['cleanup'].get('descendantPipeEOF', True) is True for case in cases)
    except (KeyError, TypeError, ValueError):
        case_complete = False
    complete = (report.exit_code == 0 and report.owned_state == 'absent'
                and report.first_failure is None and not report.secondary_failures
                and all(report.eof.values()) and case_complete)
    value['casesComplete'] = case_complete
    value['entryExitCode'] = 0 if complete else 1
    value['decision'] = 'OBSERVATIONS_COMPLETE' if complete else 'INCOMPLETE_UNKNOWN'
    for name in ('stdout', 'stderr'):
        data = value.pop(name)
        write_record(HERE / f'zombie-probe-{name}.log', data, 32768)
        value[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    write_record(HERE / 'zombie-probe-result.json', (json.dumps(value, indent=2) + '\n').encode(), 16384)
    print(json.dumps({'entryExit': value['entryExitCode'], 'childExit': report.exit_code,
                      'ownedState': report.owned_state, 'casesComplete': case_complete, 'elapsedMs': report.elapsed_ms}))
    return value['entryExitCode']


if __name__ == '__main__':
    if sys.argv[1:] == ['--probe']:
        probe()
    elif sys.argv[1:] == ['--run']:
        raise SystemExit(run())
    else:
        raise SystemExit('Exact --run entry required; execution waits for Lead window.')
