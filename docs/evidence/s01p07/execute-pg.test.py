"""Injected observations only; no child, PG, signal, or real temporary-root walk."""
from contextlib import nullcontext
import errno
from pathlib import Path
import runpy
import signal
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

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


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.identity = SimpleNamespace(st_dev=1, st_ino=2)
        self.root = SimpleNamespace(lstat=Mock(return_value=self.identity), is_symlink=Mock(return_value=False))
        self.record = {}

    def file(self, size):
        return SimpleNamespace(is_symlink=Mock(return_value=False), is_dir=Mock(return_value=False),
            is_file=Mock(return_value=True), stat=Mock(return_value=SimpleNamespace(st_size=size)))

    def sample(self, entries):
        return api["sample_temporary"](self.root, self.identity, self.record,
            scandir=lambda _: nullcontext(iter(entries)))

    def test_missing_entry_records_partial_count_and_preserves_first_failure(self):
        first, missing = self.file(7), self.file(11)
        error = FileNotFoundError(errno.ENOENT, "private synthetic path must not be recorded")
        missing.stat.side_effect = error
        with self.assertRaises(FileNotFoundError) as caught:
            self.sample([first, missing])
        self.assertIs(caught.exception, error)
        expected = {"phase": "entry-stat", "reason": "os-error", "errno": errno.ENOENT,
                    "entriesCounted": 2, "fileBytesCounted": 7}
        self.assertEqual(self.record, {"firstInventoryFailure": expected})
        first.stat.assert_called_once_with(follow_symlinks=False)
        self.root.lstat.side_effect = PermissionError(errno.EPERM, "later")
        with self.assertRaises(PermissionError): self.sample([])
        self.assertEqual(self.record["firstInventoryFailure"], expected)
        self.root.lstat.side_effect = None
        self.assertEqual(self.sample([self.file(13)]), 13)
        self.assertEqual(self.record["firstInventoryFailure"], expected)

    def test_root_and_directory_errors_have_distinct_finite_phases(self):
        for phase in ("root-lstat", "directory-open", "directory-iterate"):
            with self.subTest(phase=phase):
                self.record = {}
                error = PermissionError(errno.EACCES, "not copied")
                self.root.lstat.side_effect = error if phase == "root-lstat" else None
                def scan(_):
                    if phase == "directory-open": raise error
                    def entries():
                        raise error
                        yield
                    return nullcontext(entries())
                with self.assertRaises(PermissionError) as caught:
                    api["sample_temporary"](self.root, self.identity, self.record, scandir=scan)
                self.assertIs(caught.exception, error)
                self.assertEqual(self.record["firstInventoryFailure"], {
                    "phase": phase, "reason": "os-error", "errno": errno.EACCES,
                    "entriesCounted": 0, "fileBytesCounted": 0})

    def test_identity_link_and_special_node_guards_remain_fail_closed(self):
        link, special = self.file(10), self.file(10)
        link.is_symlink.return_value = True
        special.is_file.return_value = False
        for phase, entries in (("root-identity", []), ("entry-symlink", [link]), ("node-kind", [special])):
            with self.subTest(phase=phase):
                self.record = {}
                self.root.lstat.return_value = SimpleNamespace(st_dev=1, st_ino=99) if phase == "root-identity" else self.identity
                with self.assertRaises(RuntimeError): self.sample(entries)
                self.assertEqual(self.record["firstInventoryFailure"], {
                    "phase": phase, "reason": phase, "errno": None,
                    "entriesCounted": 0 if phase == "root-identity" else 1, "fileBytesCounted": 0})
        link.is_dir.assert_not_called()
        link.stat.assert_not_called()
        special.stat.assert_not_called()

    def test_entry_limit_is_not_relaxed_and_success_has_no_diagnostic(self):
        entry = self.file(1)
        self.assertEqual(self.sample([entry] * 4096), 4096)
        self.assertEqual(self.record, {})
        with self.assertRaises(RuntimeError): self.sample([entry] * 4097)
        self.assertEqual(self.record["firstInventoryFailure"], {
            "phase": "entry-limit", "reason": "entry-limit", "errno": None,
            "entriesCounted": 4097, "fileBytesCounted": 4096})


if __name__ == "__main__":
    unittest.main()
