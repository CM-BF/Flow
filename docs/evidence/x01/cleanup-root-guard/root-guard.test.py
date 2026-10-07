"""Four bounded filesystem regressions; extract only fixed cleanup functions, never launch PG."""
import ast
import json
import os
from pathlib import Path
import stat
import tempfile
import time
import unittest
from unittest.mock import patch

HELPER = Path(__file__).resolve().parents[1] / 'enable-binding-pg-once.py'
tree = ast.parse(HELPER.read_text())
selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in ('tree_sample', 'remove_sample', 'assert_directory')]
assert len(selected) == 3
module = {'os': os, 'stat': stat, 'time': time}
exec(compile(ast.Module(body=selected, type_ignores=[]), str(HELPER), 'exec'), module)


class RootGuard(unittest.TestCase):
    def setUp(self):
        self.container = tempfile.TemporaryDirectory(prefix='root-guard-', dir=os.environ['TMPDIR'])
        self.root = Path(self.container.name) / 'root'
        self.root.mkdir()
        (self.root / 'a').write_bytes(b'a')
        (self.root / 'b').write_bytes(b'b')
        info = self.root.lstat()
        self.identity = (info.st_dev, info.st_ino)
        self.rows, _ = module['tree_sample'](self.root, self.identity, time.monotonic() + 2, {'temporaryEntries': 16, 'temporaryBytes': 1024})

    def tearDown(self):
        self.container.cleanup()

    def swap_root(self):
        moved = self.root.parent / 'moved'
        self.root.rename(moved)
        self.root.symlink_to(moved, target_is_directory=True)
        return moved

    def test_normal_cleanup_confirms_exact_absence(self):
        module['remove_sample'](self.rows, time.monotonic() + 2)
        with self.assertRaises(FileNotFoundError):
            self.root.lstat()

    def test_root_swap_before_first_delete_preserves_both_files(self):
        moved = self.swap_root()
        with self.assertRaisesRegex(ValueError, 'Directory identity changed'):
            module['remove_sample'](self.rows, time.monotonic() + 2)
        self.assertEqual((moved / 'a').read_bytes(), b'a')
        self.assertEqual((moved / 'b').read_bytes(), b'b')

    def test_root_swap_between_deletes_preserves_remaining_file(self):
        original = Path.unlink
        first = self.rows[-1][0]
        remaining = self.rows[-2][0].name
        moved = None
        def unlink(path, *args, **kwargs):
            nonlocal moved
            result = original(path, *args, **kwargs)
            if path == first:
                moved = self.swap_root()
            return result
        with patch.object(Path, 'unlink', unlink):
            with self.assertRaisesRegex(ValueError, 'Directory identity changed'):
                module['remove_sample'](self.rows, time.monotonic() + 2)
        self.assertIsNotNone(moved)
        self.assertEqual((moved / remaining).read_bytes(), remaining.encode())
        self.assertFalse((moved / first.name).exists())

    def test_final_absence_unknown_is_not_success(self):
        original_rmdir, original_lstat = Path.rmdir, Path.lstat
        removed = False
        def rmdir(path, *args, **kwargs):
            nonlocal removed
            result = original_rmdir(path, *args, **kwargs)
            if path == self.root:
                removed = True
            return result
        def lstat(path, *args, **kwargs):
            if path == self.root and removed:
                raise PermissionError('Synthetic final absence is unknown')
            return original_lstat(path, *args, **kwargs)
        with patch.object(Path, 'rmdir', rmdir), patch.object(Path, 'lstat', lstat):
            with self.assertRaisesRegex(PermissionError, 'Synthetic final absence'):
                module['remove_sample'](self.rows, time.monotonic() + 2)
        with self.assertRaises(FileNotFoundError):
            self.root.lstat()


if __name__ == '__main__':
    outcome = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(RootGuard))
    print(json.dumps({'selected': outcome.testsRun, 'failures': len(outcome.failures), 'errors': len(outcome.errors), 'PG': 0, 'HTTP': 0}))
    raise SystemExit(0 if outcome.wasSuccessful() and outcome.testsRun == 4 else 1)
