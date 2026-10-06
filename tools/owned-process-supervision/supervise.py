"""Bounded POSIX supervision of one child created by this module.

No caller callbacks or persistence run between spawn and the stop decision.
"""
from dataclasses import dataclass, field
from enum import Enum
import math
import os
import selectors
import signal
import subprocess
import time
from typing import Mapping


class Ownership(str, Enum):
    CHILD_PID_ONLY = 'childPidOnly'
    NEW_CHILD_SESSION = 'newChildSession'


class Capture(str, Enum):
    SEPARATE = 'separate'
    MERGED = 'merged'


@dataclass(frozen=True)
class Launch:
    argv: tuple[str, ...]
    cwd: str
    env: Mapping[str, str]
    ownership: Ownership
    capture: Capture = Capture.SEPARATE


@dataclass(frozen=True)
class Policy:
    work_seconds: float
    term_grace_seconds: float
    kill_grace_seconds: float
    output_bytes: int


@dataclass
class Report:
    pid: int | None = None
    ownership: str = ''
    capture: str = Capture.SEPARATE.value
    exit_code: int | None = None
    elapsed_ms: int = 0
    stdout: bytes = b''
    stderr: bytes = b''
    observed_bytes: int = 0
    retained_bytes: int = 0
    eof: dict[str, bool] = field(default_factory=lambda: {'stdout': False, 'stderr': False})
    first_failure: dict | None = None
    secondary_failures: list[dict] = field(default_factory=list)
    signals: list[dict] = field(default_factory=list)
    owned_state: str = 'unknown'
    observations: list[dict] = field(default_factory=list)

    def fail(self, phase, code, error=None):
        # Do not copy exceptions' strings, command arguments, or environment.
        failure = {'phase': phase, 'code': code,
                   'type': type(error).__name__ if error else 'SupervisionFailure',
                   'errno': getattr(error, 'errno', None), 'message': code.lower().replace('_', ' ')}
        if self.first_failure is None:
            self.first_failure = failure
        elif len(self.secondary_failures) < 8:
            self.secondary_failures.append(failure)


def supervise(launch: Launch, policy: Policy) -> Report:
    """Return process facts; caller retains resource cleanup and durable reporting."""
    _validate(launch, policy)
    started = time.monotonic()
    report = Report(ownership=launch.ownership.value, capture=launch.capture.value)
    if launch.capture is Capture.MERGED:
        report.eof = {'stdout': False}
    try:
        child = subprocess.Popen(tuple(launch.argv), cwd=launch.cwd, env=dict(launch.env),
                                 stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT if launch.capture is Capture.MERGED else subprocess.PIPE,
                                 bufsize=0, start_new_session=True)
    except OSError as error:
        report.fail('spawn', 'SPAWN_FAILED', error)
        report.owned_state = 'absent'
        report.elapsed_ms = round((time.monotonic() - started) * 1000)
        return report
    report.pid = child.pid
    owner = _OwnedChild(child, launch.ownership, report)
    capture = _Capture(child, policy.output_bytes, report)
    try:
        capture.until_exit(owner, started + policy.work_seconds)
    except Exception as error:
        report.fail('work', 'SUPERVISION_FAILED', error)
    finally:
        stop_deadline = time.monotonic() + policy.term_grace_seconds + policy.kill_grace_seconds
        owner.finish(policy, stop_deadline)
        try:
            capture.drain_until(stop_deadline)
        except Exception as error:
            report.fail('cleanup', 'FINAL_CAPTURE_FAILED', error)
        capture.close()
        report.elapsed_ms = round((time.monotonic() - started) * 1000)
    return report


def _validate(launch, policy):
    if not isinstance(launch, Launch) or not isinstance(policy, Policy):
        raise ValueError('Launch and Policy required')
    if not isinstance(launch.capture, Capture):
        raise ValueError('Finite capture mode required')
    if not isinstance(launch.ownership, Ownership):
        raise ValueError('Finite ownership required')
    if not launch.argv or not all(isinstance(arg, str) and '\0' not in arg for arg in launch.argv):
        raise ValueError('Explicit argv required')
    if not os.path.isabs(launch.cwd):
        raise ValueError('Absolute cwd required')
    if not all(isinstance(k, str) and isinstance(v, str) and '\0' not in k + v and '=' not in k
               for k, v in launch.env.items()):
        raise ValueError('Explicit string environment required')
    for value, maximum in ((policy.work_seconds, 3600), (policy.term_grace_seconds, 10),
                           (policy.kill_grace_seconds, 10)):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= maximum:
            raise ValueError('Finite time budget required')
    if launch.ownership is Ownership.NEW_CHILD_SESSION and policy.term_grace_seconds <= 0:
        raise ValueError('New child session requires positive TERM grace')
    if policy.work_seconds <= 0 or policy.kill_grace_seconds <= 0:
        raise ValueError('Work and reap budgets must be positive')
    if type(policy.output_bytes) is not int or not 0 <= policy.output_bytes <= 1048576:
        raise ValueError('Output budget must be at most 1 MiB')
    if os.name != 'posix' or not hasattr(os, 'WNOWAIT') or not hasattr(os, 'waitid'):
        raise ValueError('POSIX waitid WNOWAIT required')
    if signal.getsignal(signal.SIGCHLD) == signal.SIG_IGN:
        raise ValueError('Child exit status must remain waitable')


class _Capture:
    def __init__(self, child, limit, report):
        self.report = report
        self.limit = limit
        self.streams = {name: stream for name, stream in
                        (('stdout', child.stdout), ('stderr', child.stderr)) if stream is not None}
        self.selector = None
        self.buffers = {'stdout': bytearray(), 'stderr': bytearray()}

    def until_exit(self, owner, deadline):
        self.selector = selectors.DefaultSelector()
        for name, stream in self.streams.items():
            os.set_blocking(stream.fileno(), False)
            self.selector.register(stream, selectors.EVENT_READ, name)
        while True:
            exited = owner.exited()
            if owner.unknown:
                return
            if exited and all(self.report.eof.values()):
                return
            if time.monotonic() >= deadline:
                self.report.fail('work', 'DEADLINE_EXCEEDED')
                return
            ready = self.selector.select(min(0.02, max(0, deadline - time.monotonic())))
            for key, _ in ready:
                if not self.read(key):
                    return

    def read(self, key):
        try:
            chunk = os.read(key.fd, 8192)
        except BlockingIOError:
            return True
        if not chunk:
            self.report.eof[key.data] = True
            self.selector.unregister(key.fileobj)
            return True
        self.report.observed_bytes += len(chunk)
        keep = chunk[:max(0, self.limit - self.report.retained_bytes)]
        self.buffers[key.data].extend(keep)
        self.report.retained_bytes += len(keep)
        if self.report.observed_bytes > self.limit:
            self.report.fail('capture', 'OUTPUT_LIMIT_EXCEEDED')
            return False
        return True

    def drain_until(self, deadline):
        if self.selector is None or self.report.observed_bytes > self.limit:
            return
        while not all(self.report.eof.values()) and time.monotonic() < deadline:
            for key, _ in self.selector.select(min(0.01, max(0, deadline - time.monotonic()))):
                if not self.read(key):
                    return

    def close(self):
        self.report.stdout = bytes(self.buffers['stdout'])
        self.report.stderr = bytes(self.buffers['stderr'])
        for resource in (self.selector, *self.streams.values()):
            if resource is None:
                continue
            try:
                resource.close()
            except Exception as error:
                self.report.fail('cleanup', 'CAPTURE_CLOSE_FAILED', error)


class _OwnedChild:
    def __init__(self, child, ownership, report):
        self.child = child
        self.ownership = ownership
        self.report = report
        self.unknown = False
        self.signal_blocked = False
        self.exit_observed = False

    def exited(self):
        if self.exit_observed or self.unknown:
            return self.exit_observed
        try:
            result = os.waitid(os.P_PID, self.child.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if result is not None:
                self.exit_observed = True
                code = result.si_status if result.si_code == os.CLD_EXITED else -result.si_status
                if code != 0:
                    self.report.fail('work', 'CHILD_EXIT_NONZERO')
        except OSError as error:
            self.unknown = True
            self.report.fail('observe', 'CHILD_IDENTITY_UNKNOWN', error)
        return self.exit_observed

    def state(self):
        if self.unknown:
            return 'unknown'
        if self.ownership is Ownership.CHILD_PID_ONLY:
            return 'absent' if self.exited() else 'unknown' if self.unknown else 'present'
        try:
            os.killpg(self.child.pid, 0)
            state, error_number = 'present', None
        except ProcessLookupError:
            state, error_number = 'absent', None
        except OSError as error:
            # A later read-only observation after reaping may confirm absence.
            # An uncertain observation permanently bars further signals.
            self.signal_blocked = True
            state, error_number = 'unknown', error.errno
        observation = {'state': state, 'errno': error_number}
        if len(self.report.observations) < 8:
            self.report.observations.append(observation)
        return state

    def send(self, action):
        if self.signal_blocked or self.state() != 'present':
            return
        try:
            if self.ownership is Ownership.CHILD_PID_ONLY:
                os.kill(self.child.pid, action)
            else:
                os.killpg(self.child.pid, action)
            state, error_number = 'sent', None
        except ProcessLookupError:
            state, error_number = 'absent', None
        except OSError as error:
            state, error_number = 'unknown', error.errno
            self.signal_blocked = True
            self.report.fail('stop', 'SIGNAL_UNKNOWN', error)
        self.report.signals.append({'signal': action.name, 'state': state, 'errno': error_number})

    def finish(self, policy, deadline):
        # WNOWAIT pins the leader PID until the last group signal. Never signal a
        # recycled PGID after reaping its original leader.
        try:
            if self.state() == 'present':
                if policy.term_grace_seconds > 0:
                    self.send(signal.SIGTERM)
                    self.wait_until(time.monotonic() + policy.term_grace_seconds)
                if not self.signal_blocked and self.state() == 'present':
                    self.send(signal.SIGKILL)
            self.reap_until(deadline)
        except Exception as error:
            self.unknown = True
            self.report.fail('cleanup', 'STOP_UNKNOWN', error)
        self.report.owned_state = 'unknown' if self.unknown else self.state()
        if self.report.owned_state != 'absent':
            self.report.fail('cleanup', 'OWNED_PROCESS_NOT_ABSENT')

    def wait_until(self, deadline):
        while time.monotonic() < deadline and not self.unknown and not self.signal_blocked:
            self.exited()
            # A group leader's exit cannot establish that the group is gone.
            if self.ownership is Ownership.CHILD_PID_ONLY and self.exit_observed:
                return
            time.sleep(min(0.01, max(0, deadline - time.monotonic())))

    def reap_until(self, deadline):
        while time.monotonic() < deadline:
            if self.child.returncode is None and self.exited():
                self.child.wait(timeout=0)
                self.report.exit_code = self.child.returncode
            if self.child.returncode is not None:
                if self.ownership is Ownership.CHILD_PID_ONLY or self.state() != 'present':
                    return
            if self.unknown or self.signal_blocked:
                return
            time.sleep(min(0.01, max(0, deadline - time.monotonic())))
