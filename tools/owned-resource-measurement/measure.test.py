"""Synthetic directory and fault tests; no external directory or file contents read."""
import errno
import os
from pathlib import Path
import stat
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import measure as meter


class MeasurementTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ.get('FLOW_METER_SCRATCH'))
        self.addCleanup(self.tmp.cleanup)
        self.parent = Path(self.tmp.name).resolve()
        self.root = self.parent / 'root'
        self.root.mkdir()
        info = self.root.stat()
        self.pin = meter.Root(str(self.root), info.st_dev, info.st_ino)

    def observe(self, **kwargs):
        return meter.measure(self.pin, limits=kwargs.pop('limits', meter.Limits(128, 1)), **kwargs)

    def test_regular_sparse_and_hardlink_counts_use_observed_blocks_per_path(self):
        (self.root / 'small').write_bytes(b'abc')
        with (self.root / 'sparse').open('wb') as stream:
            stream.truncate(2 * 1024 * 1024)
        os.link(self.root / 'small', self.root / 'alias')
        info = [p.stat() for p in self.root.iterdir()]
        result = self.observe()
        self.assertEqual(result.state, 'complete')
        self.assertEqual(result.logical_bytes, sum(x.st_size for x in info))
        self.assertEqual(result.allocated_bytes, sum(x.st_blocks * 512 for x in info))
        self.assertEqual((result.entries, result.regular_files, result.directories), (3, 3, 1))

    def test_quick_and_dperf_shapes_exclude_scratch_without_subtraction(self):
        scratch = self.root / 'scratch'
        scratch.mkdir()
        (scratch / 'growing').write_bytes(b'x' * 512)
        (self.root / 'scratch-copy').mkdir()
        (self.root / 'scratch-copy' / 'kept').write_bytes(b'kept')
        (self.root / 'report').write_bytes(b'report')
        for scratch_bytes in (512, 1024):
            (scratch / 'growing').write_bytes(b'x' * scratch_bytes)
            retained = self.observe(exclude=('scratch',))
            scratch_stat = scratch.stat()
            private = meter.measure(meter.Root(str(scratch), scratch_stat.st_dev, scratch_stat.st_ino),
                                    limits=meter.Limits(16, 1))
            self.assertEqual((retained.state, private.state), ('complete', 'complete'))
            self.assertEqual((retained.logical_bytes, private.logical_bytes), (10, scratch_bytes))
            self.assertEqual(retained.excluded_directories, 1)
            self.assertEqual(retained.logical_bytes + 20 + 30 + 40, 100)  # Quick's external reserves
            self.assertEqual(retained.logical_bytes + 17, 27)  # DPERF's separate evidence root

    def test_nested_exclusion_and_absent_exclusion_are_literal(self):
        (self.root / 'parent').mkdir()
        (self.root / 'parent' / 'private').mkdir()
        (self.root / 'parent' / 'private' / 'ignored').write_bytes(b'ignore')
        (self.root / 'parent' / 'keep').write_bytes(b'a')
        result = self.observe(exclude=('parent/private', 'not-created'))
        self.assertEqual((result.state, result.logical_bytes, result.excluded_directories), ('complete', 1, 1))

    def test_invalid_policy_or_exclusion_rejected_before_observation(self):
        with patch.object(meter.os, 'stat', side_effect=AssertionError('must not observe')):
            for exclude in (('',), ('/root',), ('..',), ('a/../b',), ('a/',), ('a', 'a/b'), ('a', 'a')):
                with self.subTest(exclude=exclude), self.assertRaises(ValueError):
                    self.observe(exclude=exclude)
            for limits in (meter.Limits(0, 1), meter.Limits(1, float('nan')), meter.Limits(1, 0),
                           meter.Limits(1, 1, 129)):
                with self.subTest(limits=limits), self.assertRaises(ValueError):
                    self.observe(limits=limits)

    def test_missing_or_replaced_root_is_unknown_not_zero_success(self):
        self.root.rmdir()
        self.assertEqual(self.observe().issue.code, 'ROOT_IO')
        self.root.mkdir()
        wrong = meter.Root(str(self.root), self.pin.device, self.root.stat().st_ino + 1)
        result = meter.measure(wrong, limits=meter.Limits(5, 1))
        self.assertEqual((result.state, result.issue.code), ('unknown', 'ROOT_IDENTITY_CHANGED'))

    def test_root_symlink_and_excluded_symlink_fail_closed(self):
        link = self.parent / 'link'
        link.symlink_to(self.root, target_is_directory=True)
        result = meter.measure(meter.Root(str(link), self.pin.device, self.pin.inode), limits=meter.Limits(5, 1))
        self.assertEqual(result.issue.code, 'ROOT_PATH_CHANGED')
        (self.root / 'scratch').symlink_to(self.parent, target_is_directory=True)
        self.assertEqual(self.observe(exclude=('scratch',)).issue.code, 'EXCLUSION_NOT_DIRECTORY')

    def test_leaf_and_directory_symlinks_are_counted_never_followed(self):
        outside = self.parent / 'outside'
        outside.mkdir()
        (outside / 'large').write_bytes(b'x' * 4096)
        (self.root / 'directory-link').symlink_to(outside, target_is_directory=True)
        (self.root / 'leaf-link').symlink_to(outside / 'large')
        (self.root / 'broken-link').symlink_to(outside / 'missing')
        result = self.observe()
        self.assertEqual((result.state, result.logical_bytes, result.allocated_bytes), ('complete', 0, 0))
        self.assertEqual((result.symlinks, result.entries, result.directories), (3, 3, 1))

    def test_enumerated_leaf_disappears_and_is_counted_separately(self):
        (self.root / 'gone').write_bytes(b'x')
        real_stat = os.stat
        def disappear(path, *args, **kwargs):
            if path == 'gone':
                (self.root / 'gone').unlink(missing_ok=True)
            return real_stat(path, *args, **kwargs)
        with patch.object(meter.os, 'stat', side_effect=disappear):
            result = self.observe()
        self.assertEqual((result.state, result.entries, result.vanished_entries, result.logical_bytes),
                         ('complete', 1, 1, 0))

    def test_leaf_replacement_between_stats_is_identity_unknown(self):
        (self.root / 'leaf').write_bytes(b'old')
        replacement = self.parent / 'replacement'
        replacement.write_bytes(b'new')
        real_stat = os.stat
        def replace(path, *args, **kwargs):
            observed = real_stat(path, *args, **kwargs)
            if path == 'leaf' and replacement.exists():
                replacement.replace(self.root / 'leaf')
            return observed
        with patch.object(meter.os, 'stat', side_effect=replace):
            result = self.observe()
        self.assertEqual((result.state, result.issue.code, result.vanished_entries),
                         ('unknown', 'ENTRY_IDENTITY_CHANGED', 0))

    def test_directory_replaced_by_symlink_before_open_is_never_followed(self):
        child = self.root / 'child'
        child.mkdir()
        outside = self.parent / 'outside'
        outside.mkdir()
        (outside / 'keep').write_bytes(b'not counted')
        real_open = os.open
        def replace(path, flags, *args, **kwargs):
            if path == 'child':
                child.rmdir()
                child.symlink_to(outside, target_is_directory=True)
            return real_open(path, flags, *args, **kwargs)
        with patch.object(meter.os, 'open', side_effect=replace):
            result = self.observe()
        self.assertEqual((result.state, result.issue.code, result.regular_files),
                         ('unknown', 'DIRECTORY_OPEN_UNKNOWN', 0))
        self.assertEqual((outside / 'keep').read_bytes(), b'not counted')

    def test_opened_directory_disconnection_is_not_transient_enoent(self):
        child = self.root / 'child'
        child.mkdir()
        inode = child.stat().st_ino
        real_scan = os.scandir
        def detach(fd):
            if os.fstat(fd).st_ino == inode:
                child.rmdir()
            return real_scan(fd)
        with patch.object(meter.os, 'scandir', side_effect=detach):
            result = self.observe()
        self.assertEqual((result.state, result.issue.code, result.vanished_entries),
                         ('unknown', 'DIRECTORY_BINDING_UNKNOWN', 0))

    def test_device_crossing_is_unknown(self):
        (self.root / 'other-device').write_bytes(b'x')
        real_stat = os.stat
        def crossing(path, *args, **kwargs):
            info = real_stat(path, *args, **kwargs)
            if path == 'other-device':
                return SimpleNamespace(st_dev=info.st_dev + 1, st_ino=info.st_ino, st_mode=info.st_mode)
            return info
        with patch.object(meter.os, 'stat', side_effect=crossing):
            result = self.observe()
        self.assertEqual(result.issue.code, 'DEVICE_BOUNDARY')

    def test_enumerated_directory_disappears_before_open(self):
        child = self.root / 'child'
        child.mkdir()
        real_open = os.open
        def disappear(path, *args, **kwargs):
            if path == 'child':
                child.rmdir()
            return real_open(path, *args, **kwargs)
        with patch.object(meter.os, 'open', side_effect=disappear):
            result = self.observe()
        self.assertEqual((result.state, result.vanished_entries, result.directories), ('complete', 1, 1))

    def test_enumeration_io_error_is_not_swallowed_and_fd_is_closed(self):
        real_close = os.close
        closed = []
        def close_fd(fd):
            closed.append(fd)
            return real_close(fd)
        with patch.object(meter.os, 'scandir', side_effect=OSError(errno.EIO, 'private error')), \
             patch.object(meter.os, 'close', side_effect=close_fd):
            result = self.observe()
        self.assertEqual(result.issue, meter.Issue('DIRECTORY_IO', '.', errno.EIO))
        self.assertEqual(len(closed), 1)

    def test_first_failure_survives_close_failure(self):
        real_close = os.close
        def close_then_error(fd):
            real_close(fd)
            raise OSError(errno.EIO, 'synthetic close error after actual close')
        with patch.object(meter.os, 'scandir', side_effect=PermissionError(errno.EACCES, 'first')), \
             patch.object(meter.os, 'close', side_effect=close_then_error):
            result = self.observe()
        self.assertEqual(result.issue, meter.Issue('DIRECTORY_IO', '.', errno.EACCES))

    def test_missing_allocated_accounting_is_unknown(self):
        (self.root / 'file').write_bytes(b'x')
        real_stat = os.stat
        def no_blocks(path, *args, **kwargs):
            info = real_stat(path, *args, **kwargs)
            if path == 'file':
                return SimpleNamespace(st_dev=info.st_dev, st_ino=info.st_ino,
                                       st_mode=info.st_mode, st_size=info.st_size)
            return info
        with patch.object(meter.os, 'stat', side_effect=no_blocks):
            result = self.observe()
        self.assertEqual((result.state, result.issue.code), ('unknown', 'FILE_ACCOUNTING_UNKNOWN'))

    def test_special_file_is_unknown(self):
        os.mkfifo(self.root / 'pipe')
        result = self.observe()
        self.assertEqual((result.state, result.issue.code), ('unknown', 'SPECIAL_FILE'))

    def test_permission_failure_is_unknown_with_safe_errno(self):
        (self.root / 'denied').write_bytes(b'x')
        real_stat = os.stat
        def denied(path, *args, **kwargs):
            if path == 'denied':
                raise PermissionError(errno.EACCES, 'must not appear in report')
            return real_stat(path, *args, **kwargs)
        with patch.object(meter.os, 'stat', side_effect=denied):
            result = self.observe()
        self.assertEqual(result.issue, meter.Issue('ENTRY_IO', 'denied', errno.EACCES))
        self.assertNotIn('must not appear', repr(result))

    def test_entry_and_depth_limits_return_partial_unknown(self):
        (self.root / 'a').write_bytes(b'a')
        (self.root / 'b').write_bytes(b'b')
        result = self.observe(limits=meter.Limits(1, 1))
        self.assertEqual((result.state, result.entries, result.logical_bytes, result.issue.code),
                         ('unknown', 1, 1, 'ENTRY_LIMIT'))
        (self.root / 'dir').mkdir()
        (self.root / 'dir' / 'deep').mkdir()
        self.assertEqual(self.observe(limits=meter.Limits(128, 1, 1)).issue.code, 'DEPTH_LIMIT')

    def test_time_bound_rejects_late_result_and_closes_descriptors(self):
        (self.root / 'leaf').write_bytes(b'x')
        ticks = [0.0]
        real_stat = os.stat
        real_open, real_close = os.open, os.close
        opened, closed = [], []
        def late(path, *args, **kwargs):
            info = real_stat(path, *args, **kwargs)
            if path == 'leaf':
                ticks[0] = 2.0
            return info
        def open_fd(*args, **kwargs):
            fd = real_open(*args, **kwargs)
            opened.append(fd)
            return fd
        def close_fd(fd):
            closed.append(fd)
            return real_close(fd)
        with patch.object(meter.time, 'monotonic', side_effect=lambda: ticks[0]), \
             patch.object(meter.os, 'stat', side_effect=late), \
             patch.object(meter.os, 'open', side_effect=open_fd), \
             patch.object(meter.os, 'close', side_effect=close_fd):
            result = self.observe()
        self.assertEqual((result.state, result.issue.code, result.logical_bytes), ('unknown', 'TIME_LIMIT', 0))
        self.assertEqual(opened, closed)


if __name__ == '__main__':
    unittest.main(verbosity=2)
