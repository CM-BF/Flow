"""Three bounded fault scenarios; isolated toy only, never the real dependency root."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SOURCE = Path('/tmp/flow-workspace-cache-payload-operator.py')
spec = importlib.util.spec_from_file_location('payload_candidate', SOURCE)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
OUTPUT = Path('/private/tmp/flow-workspace-cache-operator-toy-v2-result.json')
RESERVATION = Path('/private/tmp/flow-workspace-cache-operator-toy-v2-reservation.json')
SCRATCH = None
CASES = []


def small_environment(label, count=2):
    base = SCRATCH / label; base.mkdir()
    root = base / 'root'; root.mkdir()
    modules = root / 'node_modules'; modules.mkdir()
    store = base / 'cas'; store.mkdir()
    entries = []
    for fid in range(count):
        data = f'toy-{fid}\n'.encode()
        target = modules / f'payload-{fid}.js'; cas = store / f'payload-{fid}'
        target.write_bytes(data); cas.write_bytes(data)
        target.chmod(0o644); cas.chmod(0o644)
        tf = mod.file_facts(target, lambda: 2); cf = mod.file_facts(cas, lambda: 2)
        entries.append({'id': fid, 'path': str(target.relative_to(root)), 'identity': tf['identity'],
                        'cas': str(cas), 'casIdentity': cf['identity'], 'sha512': tf['sha512'],
                        'xattrs': tf['xattrs'], 'ownership': [tf['uid'], tf['gid'], tf['flags']]})
        assert tf['xattrs'] == cf['xattrs']
    r = root.stat(); d = modules.stat()
    journal = mod.Journal(base / 'state', b'toy-recoverable-manifest\n', {'toy': label})
    action = mod.PayloadAction(root, [r.st_dev, r.st_ino], {'node_modules': [d.st_dev, d.st_ino, stat.S_IMODE(d.st_mode)]},
                               entries, journal, label, 4, stop_free=2**60, batch_size=2)
    return base, root, journal, action


class Faults(unittest.TestCase):
    def test_replaced_same_name_is_not_removed(self):
        base, root, journal, action = small_environment('changed')
        target = root / action.entries[0]['path']
        replacement = target.with_name('replacement'); replacement.write_bytes(target.read_bytes())
        os.replace(replacement, target)
        original = target.read_bytes()
        try:
            report = action.run('retire')
            self.assertEqual(report['state'], 'PARTIAL_UNKNOWN')
            self.assertEqual(report['primaryFailure']['code'], 'TARGET_IDENTITY_CHANGED')
            self.assertEqual(report['completedFileIds'], [])
            self.assertEqual(target.read_bytes(), original)
            self.assertTrue((root / mod.MARKER).is_file())
            self.assertTrue((base / 'state/recoverable-manifest.json.gz').is_file())
            CASES.append({'case': 'same-name-replacement', 'state': report['state'], 'realTargetWrites': 0})
        finally:
            journal.close()

    def test_restore_never_overwrites_existing_or_racing_target(self):
        base, root, journal, action = small_environment('existing', 1)
        action.marker(create=True)
        target = root / action.entries[0]['path']; original = target.read_bytes()
        try:
            report = action.run('restore')
            self.assertEqual(report['primaryFailure']['code'], 'RESTORE_TARGET_EXISTS')
            self.assertEqual(target.read_bytes(), original)
        finally:
            journal.close()
        base, root, journal, action = small_environment('racing', 1)
        action.marker(create=True)
        target = root / action.entries[0]['path']; target.unlink()
        original_link = os.link
        def create_racer_then_link(src, dst, **kwargs):
            fd = os.open(dst, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=kwargs['dst_dir_fd'])
            os.write(fd, b'concurrent-owner\n'); os.close(fd)
            return original_link(src, dst, **kwargs)
        try:
            with patch.object(mod.os, 'link', side_effect=create_racer_then_link):
                report = action.run('restore')
            self.assertEqual(report['primaryFailure']['name'], 'FileExistsError')
            self.assertEqual(report['completedFileIds'], [])
            self.assertEqual(target.read_bytes(), b'concurrent-owner\n')
            self.assertTrue(list(target.parent.glob('*.flow-restore-*')))
            CASES.append({'case': 'restore-no-overwrite-existing-and-race', 'state': report['state'], 'temporary': 'retained-until-toy-cleanup'})
        finally:
            journal.close()

    def test_midway_and_checkpoint_failure_preserve_partial_facts(self):
        base, root, journal, action = small_environment('partial')
        original_unlink = os.unlink
        def fail_second(path, **kwargs):
            if path == 'payload-1.js':
                raise PermissionError('controlled fault')
            return original_unlink(path, **kwargs)
        try:
            with patch.object(mod.os, 'unlink', side_effect=fail_second):
                report = action.run('retire')
            self.assertEqual(report['state'], 'PARTIAL_UNKNOWN')
            self.assertEqual(report['completedFileIds'], [0])
            self.assertEqual(report['pendingFileId'], 1)
            self.assertFalse((root / 'node_modules/payload-0.js').exists())
            self.assertTrue((root / 'node_modules/payload-1.js').exists())
            events = [json.loads(line) for line in journal.path.read_text().splitlines()]
            self.assertEqual([e['fileId'] for e in events if e['event'] == 'after-retire'], [0])
        finally:
            journal.close()
        base, root, journal, action = small_environment('checkpoint', 1)
        original_record = journal.record
        def lose_after_unlink(event):
            if event['event'] == 'after-retire':
                raise OSError('controlled checkpoint fault')
            original_record(event)
        try:
            with patch.object(journal, 'record', side_effect=lose_after_unlink):
                report = action.run('retire')
            self.assertEqual(report['state'], 'PARTIAL_UNKNOWN')
            self.assertEqual(report['completedFileIds'], [])
            self.assertEqual(report['pendingFileId'], 0)
            self.assertFalse((root / 'node_modules/payload-0.js').exists())
            self.assertTrue((root / mod.MARKER).exists())
            CASES.append({'case': 'midway-and-post-unlink-checkpoint-failure', 'durablyCompletedFirstRun': [0], 'uncertainSecondRun': [0]})
        finally:
            journal.close()


def run():
    global SCRATCH
    space = os.statvfs('/tmp'); free = space.f_bavail * space.f_frsize
    if free < 32 * 1024**2:
        print(json.dumps({'state': 'NOT_RUN', 'freeBytes': free, 'requiredBytes': 32 * 1024**2})); return 2
    SCRATCH = Path(tempfile.mkdtemp(prefix='flow-payload-operator-toy-v2-', dir='/private/tmp')).resolve()
    identity = SCRATCH.stat(); start = time.monotonic()
    reservation = {'scope': 'resource-recovery-operator-toy-only', 'scratch': str(SCRATCH),
                   'pid': os.getpid(), 'pgid': os.getpgrp(), 'dev': identity.st_dev, 'ino': identity.st_ino, 'parentDev': SCRATCH.parent.stat().st_dev,
                   'parentIno': SCRATCH.parent.stat().st_ino, 'freeBytes': free,
                   'operatorSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                   'toySha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'realTargetWrites': 0}
    mod.write_new(RESERVATION, mod.encoded(reservation))
    text = io.StringIO()
    result = unittest.TextTestRunner(stream=text, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Faults))
    files = [p for p in SCRATCH.rglob('*') if p.is_file()]
    fixture_bytes = sum(p.stat().st_size for p in files)
    report = {**reservation, 'selected': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
              'passed': result.testsRun-len(result.failures)-len(result.errors), 'cases': CASES,
              'raw': text.getvalue(), 'fixtureBytes': fixture_bytes, 'elapsedMs': round((time.monotonic()-start)*1000),
              'cleanup': 'CHECKPOINTED_BEFORE_OWNED_CLEANUP'}
    assert fixture_bytes <= 128 * 1024 and len(mod.encoded(report)) <= 128 * 1024
    mod.write_new(OUTPUT, mod.encoded(report))
    now = SCRATCH.lstat(); assert [now.st_dev,now.st_ino] == [identity.st_dev,identity.st_ino]
    # Only the exclusive fixture root; no dependencies, symlinks, service, or external paths.
    for directory, dirs, names in os.walk(SCRATCH, topdown=False, followlinks=False):
        for name in names:
            path = Path(directory)/name; assert stat.S_ISREG(path.lstat().st_mode); path.unlink()
        for name in dirs:
            path = Path(directory)/name; assert stat.S_ISDIR(path.lstat().st_mode); path.rmdir()
    SCRATCH.rmdir(); mod.sync_directory(SCRATCH.parent)
    final = {'selected':result.testsRun,'passed':report['passed'],'exitCode':0 if result.wasSuccessful() else 1,
             'scratchRemoved':not SCRATCH.exists(),'fixtureBytes':fixture_bytes,
             'checkpointSha256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),'elapsedMs':report['elapsedMs']}
    mod.write_new(Path('/private/tmp/flow-workspace-cache-operator-toy-v2-cleanup.json'), mod.encoded(final))
    print(json.dumps(final)); return final['exitCode']


if __name__ == '__main__':
    raise SystemExit(run())
