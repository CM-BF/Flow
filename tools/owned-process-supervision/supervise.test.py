"""Controlled children only; no database, browser, provider, or user service."""
import errno
import importlib.util
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('owned_supervision', Path(__file__).with_name('supervise.py'))
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
Launch, Policy, Ownership, supervise = MODULE.Launch, MODULE.Policy, MODULE.Ownership, MODULE.supervise


def launch(code, ownership=Ownership.CHILD_PID_ONLY):
    return Launch((sys.executable, '-B', '-c', code), os.getcwd(), dict(os.environ), ownership)


def policy(work=.25, term=0, kill=.3, output=65536):
    return Policy(work, term, kill, output)


def absent(pid):
    try:
        os.kill(pid, 0)
        return False
    except ProcessLookupError:
        return True


def stop_test_child(pid, group=False):
    try:
        (os.killpg if group else os.kill)(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass
    deadline = time.monotonic() + .5
    while time.monotonic() < deadline and not absent(pid):
        time.sleep(.01)
    if not absent(pid):
        raise AssertionError('test-owned process still present')


class SupervisionTests(unittest.TestCase):
    def test_normal_short_child_keeps_streams_and_exit(self):
        result = supervise(launch("import sys; print('ok'); print('err',file=sys.stderr)"), policy())
        self.assertIsNone(result.first_failure)
        self.assertEqual(result.exit_code, 0)
        self.assertEqual((result.stdout, result.stderr), (b'ok\n', b'err\n'))
        self.assertEqual(result.retained_bytes, 7)
        self.assertTrue(all(result.eof.values()))
        self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))
        self.assertEqual(result.signals, [])

    def test_svc05h_shape_blocked_report_kills_only_operator(self):
        # The stand-in service is detached, and the operator blocks in a real
        # pipe write after publishing its child PID. No persistence callback
        # runs in the supervisor process.
        code = """import os,subprocess,sys
service = subprocess.Popen([sys.executable,'-c','import time; time.sleep(20)'],
 stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
print(service.pid,flush=True)
r,w=os.pipe()
os.write(w,b'x'*1048576)
"""
        result = supervise(launch(code), policy(work=.2, kill=.2))
        service_pid = int(result.stdout)
        try:
            self.assertEqual(result.first_failure['code'], 'DEADLINE_EXCEEDED')
            self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))
            self.assertTrue(absent(result.pid))
            self.assertFalse(absent(service_pid))
            self.assertEqual([s['signal'] for s in result.signals], ['SIGKILL'])
            self.assertLess(result.elapsed_ms, 900)
        finally:
            stop_test_child(service_pid)

    def test_svc07_shape_combined_output_limit_stops_session(self):
        code = "import os,time; os.write(1,b'o'*40000); os.write(2,b'e'*40000); time.sleep(20)"
        result = supervise(launch(code, Ownership.NEW_CHILD_SESSION), policy(work=1, term=.03))
        self.assertEqual(result.first_failure['code'], 'OUTPUT_LIMIT_EXCEEDED')
        self.assertEqual(result.retained_bytes, 65536)
        self.assertGreater(result.observed_bytes, 65536)
        self.assertLessEqual(result.observed_bytes, 65536 + 8192)
        self.assertEqual(len(result.stdout) + len(result.stderr), 65536)
        self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))
        self.assertTrue(absent(result.pid))
        self.assertLess(result.elapsed_ms, 900)

    def test_leader_exit_keeps_group_authority_until_descendant_stopped(self):
        code = """import subprocess,sys
child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(20)'])
print(child.pid,flush=True)
"""
        result = supervise(launch(code, Ownership.NEW_CHILD_SESSION), policy(work=.2, term=.03))
        descendant = int(result.stdout)
        try:
            self.assertEqual(result.exit_code, 0)
            self.assertEqual(result.first_failure['code'], 'DEADLINE_EXCEEDED')
            self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))
            self.assertTrue(absent(descendant))
            self.assertTrue(absent(result.pid))
        finally:
            if not absent(descendant):
                stop_test_child(descendant)

    def test_eof_does_not_cancel_alive_operator_deadline(self):
        result = supervise(launch("import os,time; os.close(1); os.close(2); time.sleep(20)"), policy(work=.1))
        self.assertTrue(all(result.eof.values()))
        self.assertEqual(result.first_failure['code'], 'DEADLINE_EXCEEDED')
        self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))

    def test_unknown_group_observation_never_escalates_or_reports_absent(self):
        real_killpg = os.killpg
        calls = []
        def forbidden_observation(pid, action):
            calls.append(action)
            if action == 0:
                raise PermissionError(errno.EPERM, 'secret observation detail')
            return real_killpg(pid, action)
        with patch.object(MODULE.os, 'killpg', forbidden_observation):
            result = supervise(launch('import time; time.sleep(20)', Ownership.NEW_CHILD_SESSION), policy(work=.1))
        try:
            self.assertEqual(result.first_failure['code'], 'DEADLINE_EXCEEDED')
            self.assertEqual(result.owned_state, 'unknown')
            self.assertTrue(calls and all(action == 0 for action in calls))
            self.assertLessEqual(len(calls), 3)
            self.assertEqual(result.signals, [])
            self.assertNotIn('secret', str(result.first_failure) + str(result.secondary_failures))
            self.assertTrue(any(x['state'] == 'unknown' and x['errno'] == errno.EPERM for x in result.observations))
        finally:
            stop_test_child(result.pid, group=True)

    def test_signal_permission_failure_does_not_escalate(self):
        real_killpg = os.killpg
        def deny_term(pid, action):
            if action == signal.SIGTERM:
                raise PermissionError(errno.EPERM, 'sensitive failure')
            return real_killpg(pid, action)
        with patch.object(MODULE.os, 'killpg', deny_term):
            result = supervise(launch('import time; time.sleep(20)', Ownership.NEW_CHILD_SESSION), policy(work=.1, term=.03))
        try:
            self.assertEqual(result.owned_state, 'present')
            self.assertTrue(any(x['code'] == 'SIGNAL_UNKNOWN' for x in result.secondary_failures))
            self.assertEqual([s['signal'] for s in result.signals], ['SIGTERM'])
            self.assertEqual(result.signals[0]['state'], 'unknown')
            self.assertEqual(result.first_failure['code'], 'DEADLINE_EXCEEDED')
        finally:
            stop_test_child(result.pid, group=True)

    def test_cleanup_failure_keeps_primary_work_failure(self):
        real_selector = MODULE.selectors.DefaultSelector
        class CloseFailure:
            def __init__(self): self.real = real_selector()
            def register(self, *args): return self.real.register(*args)
            def unregister(self, *args): return self.real.unregister(*args)
            def select(self, *args): return self.real.select(*args)
            def close(self):
                self.real.close()
                raise OSError(errno.EIO, 'sensitive cleanup detail')
        with patch.object(MODULE.selectors, 'DefaultSelector', CloseFailure):
            result = supervise(launch('import sys; sys.exit(7)'), policy())
        self.assertEqual(result.first_failure['code'], 'CHILD_EXIT_NONZERO')
        self.assertEqual(result.exit_code, 7)
        self.assertEqual(result.secondary_failures[-1]['code'], 'CAPTURE_CLOSE_FAILED')
        self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))
        self.assertNotIn('sensitive', str(result.secondary_failures))

    def test_final_output_is_drained_after_stop_before_pipe_close(self):
        code = "import signal,time; signal.signal(signal.SIGTERM,lambda *_: (print('shutdown',flush=True),exit(0))); time.sleep(20)"
        result = supervise(launch(code), policy(work=.15, term=.1))
        self.assertEqual(result.first_failure['code'], 'DEADLINE_EXCEEDED')
        self.assertEqual(result.stdout, b'shutdown\n')
        self.assertTrue(all(result.eof.values()))
        self.assertEqual(result.owned_state, 'absent')

    def test_normal_session_exits_without_converting_zombie_eperm_to_absence(self):
        result = supervise(launch("print('done')", Ownership.NEW_CHILD_SESSION), policy(term=.02))
        self.assertIsNone(result.first_failure)
        self.assertEqual(result.exit_code, 0)
        self.assertEqual(result.owned_state, 'absent')
        self.assertTrue(result.observations)
        self.assertEqual(result.observations[-1]['state'], 'absent')

    def test_spawn_failure_does_not_leak_command_or_exception(self):
        result = supervise(Launch(('/no-such-ops14-secret',), os.getcwd(), {}, Ownership.CHILD_PID_ONLY), policy())
        self.assertIsNone(result.pid)
        self.assertEqual(result.owned_state, 'absent', (result.first_failure, result.secondary_failures, result.observations))
        self.assertEqual(result.first_failure['code'], 'SPAWN_FAILED')
        self.assertNotIn('secret', str(result.first_failure))

    def test_new_session_zero_term_grace_is_rejected_before_spawn(self):
        with patch.object(MODULE.subprocess, 'Popen') as spawn:
            with self.assertRaisesRegex(ValueError, 'positive TERM grace'):
                supervise(launch('pass', Ownership.NEW_CHILD_SESSION), policy(term=0))
            spawn.assert_not_called()

    def test_invalid_policy_or_external_pid_not_accepted(self):
        for invalid in (Policy(float('inf'),0,.1,64), Policy(.1,0,.1,1048577), Policy(.1,0,0,64)):
            with self.assertRaises(ValueError): supervise(launch('pass'), invalid)
        with self.assertRaises(ValueError):
            supervise(Launch((sys.executable,), os.getcwd(), {}, 'arbitraryPID'), policy())


if __name__ == '__main__':
    unittest.main(verbosity=2)
