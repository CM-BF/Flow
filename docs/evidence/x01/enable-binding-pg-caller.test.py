"""Pure qualification checks: no database, process launch, listener, or provider."""
import copy
import importlib.util
import os
from pathlib import Path
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('x01_pg_caller', Path(__file__).with_name('enable-binding-pg-once.py'))
caller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(caller)


class ResourceQualification(unittest.TestCase):
    def records(self):
        common = dict(window='a' * 32, sourceHead='b' * 40, suite='runtime', database='flow_x01_' + 'c' * 32)
        identity = dict(oid='123', owner='flow', marker='x01:owned')
        cleanup = {key: True for key in ['ownersClosed', 'poolClosed', 'adminClosed', 'createRequested', 'createAcknowledged', 'creationReceiptSaved', 'identityConfirmed', 'dropRequested', 'dropAcknowledged', 'databaseAbsent']}
        cleanup.update(identity=identity, connections=0, owners=dict(startup=True, server=True, boss=True))
        return {name: dict(common, **value) for name, value in {
            'reservation': {}, 'create-request': dict(owner='flow', marker='x01:owned'), 'created': dict(identity=identity),
            'result': dict(cleanup=cleanup, cleanupConfirmed=True, retainedDatabase=None, errors=[], errorCount=0, listeners=[dict(closed=True), dict(closed=True)])}.items()}

    def test_complete_matching_receipts_are_required(self):
        rows = self.records()
        self.assertTrue(caller.suite_confirmed('runtime', rows, 'a' * 32, 'b' * 40))
        for key in ['window', 'sourceHead', 'suite', 'database']:
            changed = copy.deepcopy(rows); changed['created'][key] = 'other'
            self.assertFalse(caller.suite_confirmed('runtime', changed, 'a' * 32, 'b' * 40))

    def test_unknown_owner_marker_connection_or_listener_never_confirms(self):
        for kind in ['owner', 'marker', 'connection', 'listener', 'retained', 'error']:
            rows = self.records()
            if kind == 'owner': rows['result']['cleanup']['owners']['server'] = False
            if kind == 'marker': rows['create-request']['marker'] = 'different'
            if kind == 'connection': rows['result']['cleanup']['connections'] = 1
            if kind == 'listener': rows['result']['listeners'][0]['closed'] = False
            if kind == 'retained': rows['result']['retainedDatabase'] = rows['result']['database']
            if kind == 'error': rows['result']['errorCount'] = 1
            self.assertFalse(caller.suite_confirmed('runtime', rows, 'a' * 32, 'b' * 40), kind)

    def test_bounded_read_rejects_symlink_and_oversize(self):
        with tempfile.TemporaryDirectory(prefix='x01-caller-read-') as directory:
            root = Path(directory); data = root / 'data'; data.write_bytes(b'1234')
            alias = root / 'alias'; alias.symlink_to(data)
            with self.assertRaises(OSError): caller.read_regular(alias, 4)
            with self.assertRaises(ValueError): caller.read_regular(data, 3)
            self.assertEqual(caller.read_regular(data, 4), b'1234')

    def test_inventory_rejects_unknown_kind_identity_budget_and_deadline(self):
        with tempfile.TemporaryDirectory(prefix='x01-caller-sample-') as directory:
            root = Path(directory).resolve(); item = root.lstat(); identity = (item.st_dev, item.st_ino)
            (root / 'data').write_bytes(b'1234'); limits = dict(temporaryEntries=4, temporaryBytes=4)
            rows, size = caller.tree_sample(root, identity, time.monotonic() + 1, limits)
            self.assertEqual((len(rows), size), (2, 4))
            with self.assertRaises(ValueError): caller.tree_sample(root, (0, 0), time.monotonic() + 1, limits)
            with self.assertRaises(ValueError): caller.tree_sample(root, identity, time.monotonic() + 1, dict(limits, temporaryBytes=3))
            with self.assertRaises(TimeoutError): caller.tree_sample(root, identity, time.monotonic() - 1, limits)
            (root / 'alias').symlink_to(root / 'data')
            with self.assertRaises(ValueError): caller.tree_sample(root, identity, time.monotonic() + 1, limits)

    def test_changed_cleanup_identity_preserves_replacement(self):
        with tempfile.TemporaryDirectory(prefix='x01-caller-delete-') as directory:
            root = Path(directory).resolve(); item = root.lstat(); data = root / 'data'; data.write_bytes(b'1')
            rows, _ = caller.tree_sample(root, (item.st_dev, item.st_ino), time.monotonic() + 1, dict(temporaryEntries=3, temporaryBytes=4))
            data.rename(root / 'old'); data.write_bytes(b'2')
            with self.assertRaises(ValueError): caller.remove_sample(rows, time.monotonic() + 1)
            self.assertEqual(data.read_bytes(), b'2')


if __name__ == '__main__': unittest.main(verbosity=2)
