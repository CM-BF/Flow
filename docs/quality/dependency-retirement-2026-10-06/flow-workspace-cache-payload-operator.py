"""One frozen workspace payload candidate. No real action without a later permit.

This is cooperative maintenance, not an OS lock against concurrent writers.
Run the command only under the already-reviewed owned-process supervisor; fsync
and system calls require its independent deadline. No recursive removal, install,
package execution, automatic retry, marker clearing, or directory cleanup.
"""
import argparse
import base64
import ctypes
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import time

STATE_PARENT = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/docs/quality/dependency-retirement-2026-10-06/actions')
CANDIDATE = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-cache'
PACKED_SHA = 'b5f39740a9f4db45a0b5793680834233d382235f1e4a663cc98f3a06a5dcd9b3'
RAW_MAP_SHA = '064104abd211285b77e8febfbde451e7cfcdb1c5fd3780cb2bdfce381ace8ab3'
STOP_FREE = 1241513984  # 1 GiB + 160 MiB; an observed volume threshold, not reclaimed bytes.
MARKER = 'node_modules/NOT_RUNTIME_READY.flow-payload.json'
EVIDENCE_LIMIT = 10 * 1024 * 1024
RETIRE_MIN_FREE = 32 * 1024 * 1024
OUTER_OUTPUT_RESERVE = 1024 * 1024
LIB = ctypes.CDLL(None, use_errno=True)
LIB.listxattr.argtypes = [ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int]
LIB.listxattr.restype = ctypes.c_ssize_t
LIB.getxattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
LIB.getxattr.restype = ctypes.c_ssize_t


class Refused(RuntimeError):
    pass


def require(condition, code):
    if not condition:
        raise Refused(code)


def encoded(value):
    return (json.dumps(value, separators=(',', ':')) + '\n').encode()


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_new(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(path.parent)


def identity(s):
    return [s.st_dev, s.st_ino, s.st_mtime_ns, s.st_size, stat.S_IMODE(s.st_mode)]


def attributes(path):
    raw = os.fsencode(path)
    size = LIB.listxattr(raw, None, 0, 1)
    require(0 <= size <= 4096, 'XATTR_NAMES_UNKNOWN')
    names = ctypes.create_string_buffer(size or 1)
    require(LIB.listxattr(raw, names, size, 1) == size, 'XATTR_NAMES_CHANGED')
    result = []
    for name in sorted(n for n in names.raw[:size].split(b'\0') if n):
        count = LIB.getxattr(raw, name, None, 0, 0, 1)
        require(0 <= count <= 4096, 'XATTR_VALUE_UNKNOWN')
        value = ctypes.create_string_buffer(count or 1)
        require(LIB.getxattr(raw, name, value, count, 0, 1) == count, 'XATTR_VALUE_CHANGED')
        result.append({'name': name.decode('utf8'), 'bytes': count,
                       'sha256': hashlib.sha256(value.raw[:count]).hexdigest()})
    return result


def no_acl(paths, remaining):
    require(len(paths) <= 64 and all(not any(ord(c) < 32 or ord(c) == 127 for c in str(p)) for p in paths), 'ACL_PATH_BOUND')
    before = {str(p): (p.lstat().st_dev, p.lstat().st_ino, p.lstat().st_ctime_ns) for p in paths}
    run = subprocess.run(['/bin/ls', '-lden', *map(str, paths)], stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, timeout=min(2, remaining()),
                         env={'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'})
    require(run.returncode == 0 and not run.stderr and len(run.stdout) <= 262144, 'ACL_READ_UNKNOWN')
    observed = []
    for line in run.stdout.decode('utf8').splitlines():
        require(line.startswith('-') and ' /' in line and '+' not in line.split()[0], 'ACL_PRESENT_OR_UNKNOWN')
        observed.append('/' + line.split(' /', 1)[1])
    require(sorted(observed) == sorted(map(str, paths)), 'ACL_PATH_MISMATCH')
    after = {str(p): (p.lstat().st_dev, p.lstat().st_ino, p.lstat().st_ctime_ns) for p in paths}
    require(before == after, 'ACL_CHANGED_DURING_READ')
    return after


def file_facts(path, remaining, expected_size=None):
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == os.getuid()
                and getattr(before, 'st_flags', 0) == 0, 'FILE_TYPE_OWNER_FLAGS')
        require(expected_size is None or before.st_size == expected_size, 'FILE_SIZE_CHANGED')
        digest = hashlib.sha512()
        while True:
            remaining()
            block = os.read(fd, 65536)
            if not block:
                break
            digest.update(block)
        attrs = attributes(path)
        after = os.fstat(fd)
        named = path.lstat()
        require(identity(before) == identity(after) == identity(named)
                and before.st_ctime_ns == after.st_ctime_ns == named.st_ctime_ns,
                'FILE_CHANGED_DURING_READ')
        return {'identity': identity(before), 'uid': before.st_uid, 'gid': before.st_gid,
                'flags': getattr(before, 'st_flags', 0), 'nlink': before.st_nlink,
                'sha512': digest.hexdigest(), 'xattrs': attrs, 'ctime_ns': before.st_ctime_ns}
    finally:
        os.close(fd)


class Journal:
    def __init__(self, directory, snapshot, binding):
        require(len(snapshot) + len(encoded(binding)) + OUTER_OUTPUT_RESERVE + 16384 < EVIDENCE_LIMIT - 512 * 1024, 'INITIAL_EVIDENCE_LIMIT')
        self.base_bytes = len(snapshot) + len(encoded(binding)) + OUTER_OUTPUT_RESERVE + 16384
        directory.mkdir(mode=0o700)  # exclusive; no reuse of an earlier run
        sync_directory(directory.parent)
        self.directory = directory
        write_new(directory / 'recoverable-manifest.json.gz', snapshot)
        write_new(directory / 'intent.json', encoded(binding))
        self.bytes = 0
        self.path = directory / 'events.jsonl'
        self.fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        sync_directory(directory)

    def record(self, event):
        data = encoded(event)
        require(self.base_bytes + self.bytes + len(data) <= EVIDENCE_LIMIT - 512 * 1024, 'JOURNAL_BYTE_LIMIT')
        offset = 0
        while offset < len(data):
            count = os.write(self.fd, data[offset:])
            require(count > 0, 'JOURNAL_WRITE_NO_PROGRESS')
            offset += count
        os.fsync(self.fd)
        self.bytes += len(data)

    def reserve_action(self):
        require(self.base_bytes + self.bytes + 1024 <= EVIDENCE_LIMIT - 512 * 1024, 'ACTION_EVIDENCE_BUDGET')

    def finish(self, report):
        require(len(encoded(report)) <= 512 * 1024, 'REPORT_BYTE_LIMIT')
        write_new(self.directory / 'result.json', encoded(report))

    def close(self):
        os.close(self.fd)


class PayloadAction:
    def __init__(self, root, root_identity, directories, entries, journal, run_id,
                 seconds, stop_free=STOP_FREE, batch_size=16):
        self.root = Path(root)
        self.root_identity = root_identity
        self.directories = directories
        self.entries = entries
        self.journal = journal
        self.run_id = run_id
        self.deadline = time.monotonic() + seconds
        self.stop_free = stop_free
        self.batch_size = batch_size
        self.acl_binding = {}
        require(0 < seconds <= 120 and 1 <= batch_size <= 32, 'ACTION_BOUND')

    def remaining(self):
        remaining = self.deadline - time.monotonic()
        require(remaining > 0, 'DEADLINE_REACHED')
        return remaining

    def parent(self, relative):
        parts = Path(relative).parts
        require(parts and all(p not in ('', '.', '..') for p in parts) and not Path(relative).is_absolute(), 'RELATIVE_PATH_REQUIRED')
        fd = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            s = os.fstat(fd)
            require([s.st_dev, s.st_ino] == self.root_identity, 'ROOT_CHANGED')
            prefix = []
            for part in parts[:-1]:
                prefix.append(part)
                next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd)
                fd = next_fd
                current = os.fstat(fd)
                require([current.st_dev, current.st_ino, stat.S_IMODE(current.st_mode)] == self.directories['/'.join(prefix)], 'PARENT_CHANGED')
            return fd, parts[-1]
        except BaseException:
            os.close(fd)
            raise

    def check(self, entry, target=True):
        self.remaining()
        path = self.root / entry['path'] if target else Path(entry['cas'])
        facts = file_facts(path, self.remaining, entry['identity'][3])
        expected_identity = entry['identity'] if target else entry['casIdentity']
        require(facts['identity'] == expected_identity, 'TARGET_IDENTITY_CHANGED' if target else 'CAS_IDENTITY_CHANGED')
        require(facts['sha512'] == entry['sha512'] and facts['xattrs'] == entry['xattrs']
                and [facts['uid'], facts['gid'], facts['flags']] == entry['ownership'], 'CONTENT_OR_ATTRIBUTES_CHANGED')
        if self.acl_binding:
            require((facts['identity'][0], facts['identity'][1], facts['ctime_ns']) == self.acl_binding[str(path)], 'ACL_SNAPSHOT_CHANGED')
        if target:
            require(facts['nlink'] == 1, 'TARGET_HARDLINK')
        return facts

    def marker(self, create):
        path = self.root / MARKER
        data = {'state': 'NOT_RUNTIME_READY', 'root': str(self.root),
                'rootIdentity': self.root_identity, 'retirementRun': self.run_id,
                'stateDirectory': str(self.journal.directory),
                'replay': 'Restore exact missing payloads, verify pinned inputs, then obtain fresh runtime admission.'}
        parent, name = self.parent(MARKER)
        try:
            if create:
                fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
                with os.fdopen(fd, 'wb') as stream:
                    stream.write(encoded(data)); stream.flush(); os.fsync(stream.fileno())
                os.fsync(parent)
            else:
                fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
                with os.fdopen(fd, 'rb') as stream:
                    s = os.fstat(stream.fileno())
                    require(stat.S_ISREG(s.st_mode) and s.st_uid == os.getuid() and s.st_size <= 4096, 'MARKER_UNKNOWN')
                    old = json.load(stream)
                require(old['state'] == 'NOT_RUNTIME_READY' and old['rootIdentity'] == self.root_identity
                        and old['root'] == str(self.root), 'MARKER_BINDING')
        finally:
            os.close(parent)

    def retire_one(self, entry):
        parent, name = self.parent(entry['path'])
        try:
            self.check(entry); self.check(entry, target=False)
            self.remaining()
            named = os.stat(name, dir_fd=parent, follow_symlinks=False)
            require(identity(named) == entry['identity'] and named.st_ctime_ns == self.acl_binding[str(self.root / entry['path'])][2], 'TARGET_IDENTITY_CHANGED')
            # Cooperative freeze is necessary: POSIX unlink is not compare-and-delete.
            os.unlink(name, dir_fd=parent)
            os.fsync(parent)
        finally:
            os.close(parent)

    def restore_one(self, entry):
        parent, name = self.parent(entry['path'])
        temporary = f'.{name}.flow-restore-{self.run_id}-{entry["id"]}'
        temp_path = (self.root / entry['path']).with_name(temporary)
        try:
            try:
                os.stat(name, dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise Refused('RESTORE_TARGET_EXISTS')
            self.check(entry, target=False)
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
            temporary_identity = os.fstat(fd)
            os.close(fd)
            self.journal.record({'event': 'restore-temporary', 'fileId': entry['id'], 'name': temporary,
                                 'dev': temporary_identity.st_dev, 'ino': temporary_identity.st_ino})
            copied = subprocess.run(['/bin/cp', '-p', entry['cas'], str(temp_path)],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    timeout=min(5, self.remaining()))
            require(copied.returncode == 0 and not copied.stdout and not copied.stderr, 'COPY_FAILED')
            restored = file_facts(temp_path, self.remaining, entry['identity'][3])
            require(restored['identity'][:2] == [temporary_identity.st_dev, temporary_identity.st_ino], 'RESTORE_TEMP_CHANGED')
            require(restored['sha512'] == entry['sha512'] and restored['identity'][3:] == entry['identity'][3:]
                    and restored['xattrs'] == entry['xattrs']
                    and [restored['uid'], restored['gid'], restored['flags']] == entry['ownership'], 'RESTORE_MISMATCH')
            no_acl([temp_path], self.remaining)
            self.check(entry, target=False)
            fd = os.open(temporary, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
            try:
                require(identity(os.fstat(fd)) == restored['identity'], 'RESTORE_TEMP_CHANGED')
                os.fsync(fd)
            finally:
                os.close(fd)
            self.remaining()
            # link is atomic no-replace: a concurrent destination is never overwritten.
            os.link(temporary, name, src_dir_fd=parent, dst_dir_fd=parent, follow_symlinks=False)
            os.fsync(parent)
            os.unlink(temporary, dir_fd=parent)
            os.fsync(parent)
        finally:
            os.close(parent)

    def run(self, action):
        require(action in ('retire', 'restore'), 'ACTION_UNKNOWN')
        report = {'action': action, 'runId': self.run_id, 'state': 'UNKNOWN',
                  'completedFileIds': [], 'pendingFileId': None, 'primaryFailure': None,
                  'cleanup': 'NONE; marker and partial resources retained', 'batches': []}
        try:
            self.marker(create=action == 'retire')
            self.journal.record({'event': 'ready', 'action': action})
            for offset in range(0, len(self.entries), self.batch_size):
                self.remaining()
                space = os.statvfs(self.root)
                free = space.f_bavail * space.f_frsize
                report['batches'].append({'offset': offset, 'freeBytes': free})
                self.journal.record({'event': 'batch', **report['batches'][-1]})
                if action == 'retire' and free >= self.stop_free:
                    report['state'] = 'STOPPED_AT_FREE_THRESHOLD'
                    break
                batch = self.entries[offset:offset + self.batch_size]
                acl_paths = {str(Path(e['cas'])) for e in batch}
                if action == 'retire':
                    acl_paths.update(str(self.root / e['path']) for e in batch)
                self.acl_binding = no_acl([Path(p) for p in sorted(acl_paths)], self.remaining)
                for entry in batch:
                    self.remaining()
                    self.journal.reserve_action()
                    report['pendingFileId'] = entry['id']
                    self.journal.record({'event': 'before-' + action, 'fileId': entry['id']})
                    (self.retire_one if action == 'retire' else self.restore_one)(entry)
                    self.journal.record({'event': 'after-' + action, 'fileId': entry['id']})
                    report['completedFileIds'].append(entry['id'])
                    report['pendingFileId'] = None
            else:
                report['state'] = 'EXACT_SELECTED_SET_FINISHED'
        except Exception as error:
            report['state'] = 'PARTIAL_UNKNOWN' if report['pendingFileId'] is not None else 'STOPPED_FAILED'
            report['primaryFailure'] = {'name': type(error).__name__, 'code': str(error)[:160] if isinstance(error, Refused) else 'SYSTEM_CALL_FAILED'}
        try:
            self.journal.finish(report)
        except Exception as error:
            report['state'] = 'PARTIAL_UNKNOWN'
            report['checkpointFailure'] = type(error).__name__
        return report


def read_regular(path, limit):
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == os.getuid() and before.st_size <= limit, 'BOUNDED_REGULAR_INPUT_REQUIRED')
        data = b''
        while len(data) <= limit:
            block = os.read(fd, min(65536, limit + 1 - len(data)))
            if not block:
                break
            data += block
        require(len(data) == before.st_size and identity(os.fstat(fd)) == identity(before), 'INPUT_CHANGED')
        return data
    finally:
        os.close(fd)


def load_frozen(path):
    packed = read_regular(path, 3311047)
    require(hashlib.sha256(packed).hexdigest() == PACKED_SHA, 'MANIFEST_HASH')
    document = json.loads(gzip.decompress(packed))
    mapping = document['payloadMapWithoutRedundantSRI']
    mapping['casColumns'].insert(1, 'sha512SRI')
    for row in mapping['cas']:
        row.insert(1, 'sha512-' + base64.b64encode(bytes.fromhex(row[0].replace('/', '').removesuffix('-exec'))).decode())
    require(hashlib.sha256(encoded(mapping)).hexdigest() == RAW_MAP_SHA and mapping['candidateRoot'] == CANDIDATE, 'MAP_BINDING')
    return packed, mapping, document['qualification']


def entries_for(mapping, qualification, ids):
    require(ids == sorted(set(ids)) and set(ids) <= set(qualification['eligibleFileIds']), 'EXACT_ELIGIBLE_SET')
    entries = []
    for fid in ids:
        row = mapping['files'][fid]; cas = mapping['cas'][row[7]]
        metadata = qualification['targetMetadata'][fid]
        entries.append({'id': fid, 'path': str(Path(mapping['packages'][row[0]]['targetPrefix']) / row[1]),
                        'identity': row[2:7], 'cas': str(Path(mapping['CASRoot']) / cas[0]),
                        'casIdentity': cas[2:7], 'sha512': base64.b64decode(cas[1][7:]).hex(),
                        'xattrs': qualification['xattrProfiles'][metadata[3]], 'ownership': metadata[:3]})
    return entries


def verify_preserved(mapping, deadline):
    def remaining():
        require(time.monotonic() < deadline, 'PREFLIGHT_DEADLINE')
    root = Path(mapping['candidateRoot'])
    for relative, dev, ino, mode in mapping['preserve']['directories']:
        remaining(); s = (root / relative).lstat()
        require(stat.S_ISDIR(s.st_mode) and [s.st_dev, s.st_ino, stat.S_IMODE(s.st_mode)] == [dev, ino, mode], 'PRESERVED_DIRECTORY_CHANGED')
    for relative, destination, dev, ino in mapping['preserve']['symlinks']:
        remaining(); path = root / relative; s = path.lstat()
        require(stat.S_ISLNK(s.st_mode) and [s.st_dev, s.st_ino] == [dev, ino] and os.readlink(path) == destination, 'PRESERVED_LINK_CHANGED')
    reads = []
    for row in mapping['preserve']['generatedAndRootCache']:
        reads.append((root / row[0], row[1:6], row[6]))
    for package in mapping['packages']:
        path = Path(package['indexPath']); s = path.lstat()
        reads.append((path, [package['indexDev'], package['indexIno'], package['indexMtimeNs'], package['indexBytes'], stat.S_IMODE(s.st_mode)], package['indexSha256']))
    for path, expected, sha in reads:
        remaining(); fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
        try:
            s = os.fstat(fd)
            require(stat.S_ISREG(s.st_mode) and identity(s) == expected and s.st_size <= 4 * 1024 * 1024, 'PRESERVED_FILE_CHANGED')
            digest = hashlib.sha256()
            while block := os.read(fd, 65536):
                remaining(); digest.update(block)
            require(identity(os.fstat(fd)) == expected and digest.hexdigest() == sha, 'PRESERVED_HASH_CHANGED')
        finally:
            os.close(fd)


def execute(permit_path, manifest_path):
    # This entry is NOT a grant. Lead supplies a reviewed one-shot permit later.
    p = Path(permit_path); s = p.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid == os.getuid() and s.st_size <= 16384, 'PERMIT_FILE')
    permit_bytes = read_regular(p, 16384); permit = json.loads(permit_bytes)
    source_sha = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    require(permit['operatorSha256'] == source_sha and permit['manifestSha256'] == PACKED_SHA
            and permit['candidateRoot'] == CANDIDATE and permit['action'] in ('retire', 'restore')
            and permit['cooperativeOwnerFreeze'] is True and permit['freshLedgerAndKernelReviewed'] is True
            and permit['independentSupervisorRequired'] is True, 'PERMIT_BINDING')
    require(re.fullmatch('[a-f0-9]{32}', permit['runId']) is not None and time.time() <= permit['startBeforeUnix'], 'PERMIT_EXPIRED_OR_ID')
    operation_started = time.monotonic()
    require(0 < permit['workSeconds'] <= 120, 'PERMIT_TIME_BOUND')
    packed, mapping, qualification = load_frozen(manifest_path)
    verify_preserved(mapping, operation_started + permit['workSeconds'])
    ids = qualification['eligibleFileIds'] if permit['action'] == 'retire' else permit['exactRestoreFileIds']
    entries = entries_for(mapping, qualification, ids)
    required_free = RETIRE_MIN_FREE if permit['action'] == 'retire' else 1024**3 + sum(e['identity'][3] for e in entries) + 12 * 1024**2
    space = os.statvfs(CANDIDATE)
    require(space.f_bavail * space.f_frsize >= required_free, 'FRESH_FREE_GATE')
    parent_state = STATE_PARENT.lstat()
    require(stat.S_ISDIR(parent_state.st_mode) and not STATE_PARENT.is_symlink()
            and [parent_state.st_dev, parent_state.st_ino] == permit['stateParentIdentity'], 'DURABLE_STATE_PARENT_CHANGED')
    directory = STATE_PARENT / permit['runId']
    journal = Journal(directory, packed, {'permit': permit, 'permitSha256': hashlib.sha256(permit_bytes).hexdigest(),
                                         'originalMapSha256': RAW_MAP_SHA, 'state': 'UNKNOWN_UNTIL_DURABLE_RESULT'})
    try:
        action = PayloadAction(CANDIDATE, [mapping['rootDev'], mapping['rootIno']],
                               {r[0]: r[1:4] for r in mapping['preserve']['directories']},
                               entries, journal, permit['runId'], permit['workSeconds'] - (time.monotonic() - operation_started))
        report = action.run(permit['action'])
        # This small output is supplemental. Durable journal is the recovery source.
        print(json.dumps({'state': report['state'], 'stateDirectory': str(directory),
                          'completedCount': len(report['completedFileIds']), 'pendingFileId': report['pendingFileId']}), flush=True)
        return 0 if report['state'] in ('EXACT_SELECTED_SET_FINISHED', 'STOPPED_AT_FREE_THRESHOLD') else 1
    finally:
        journal.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--permit', required=True)
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()
    raise SystemExit(execute(args.permit, args.manifest))
