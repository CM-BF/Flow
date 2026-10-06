"""Only injected process observations; no child, PG, signal, or target is started."""
import errno
from pathlib import Path
import runpy
import signal
import subprocess
import unittest

api = runpy.run_path(str(Path(__file__).with_name("execute-pg.py")))


class FakeProcess:
    pid = 123

    def poll(self):
        return None

    def wait(self, timeout):
        raise subprocess.TimeoutExpired("fake", timeout)


class LifecycleTests(unittest.TestCase):
    def test_eperm_observation_retains_unknown_without_sending(self):
        def denied(pid, action):
            raise PermissionError(errno.EPERM, "synthetic")
        signals = []
        result = api["finish_process"](FakeProcess(),
            observe=lambda pid: api["observe_group"](pid, denied),
            send=lambda *args: signals.append(args))
        self.assertEqual(result["groupState"], {"state": "unknown", "errno": errno.EPERM})
        self.assertTrue(result["unknown"])
        self.assertFalse(result["groupAbsent"])
        self.assertEqual(signals, [])

    def test_eperm_term_does_not_retry_or_escalate(self):
        calls = []
        def denied(pid, action):
            calls.append(action)
            raise PermissionError(errno.EPERM, "synthetic")
        result = api["finish_process"](FakeProcess(),
            observe=lambda _: {"state": "present", "errno": None},
            send=lambda pid, action: api["signal_group"](pid, action, denied))
        self.assertEqual(calls, [signal.SIGTERM])
        self.assertTrue(result["unknown"])
        self.assertEqual(result["signals"][0]["errno"], errno.EPERM)

    def test_confirmed_group_allows_at_most_one_term_and_kill(self):
        states = iter(["present", "present", "absent"])
        calls = []
        def sent(pid, action):
            calls.append(action)
            return {"state": "sent", "errno": None, "signal": action}
        result = api["finish_process"](FakeProcess(),
            observe=lambda _: {"state": next(states), "errno": None}, send=sent)
        self.assertEqual(calls, [signal.SIGTERM, signal.SIGKILL])
        self.assertTrue(result["groupAbsent"])
        self.assertIsNone(result["exitCode"])
        self.assertFalse(result["unknown"])


if __name__ == "__main__":
    unittest.main()
