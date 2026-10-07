"""One fixed, offline, build-only YAML installation. Not an artifact build."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time

EVIDENCE = Path(__file__).resolve().parent
ROOT = EVIDENCE.parents[2]
PRIVATE = ROOT / 'node_modules/.svc06-parser-env'
ALIAS = ROOT / 'node_modules/yaml'
INPUTS = json.loads((EVIDENCE / 'parser-install-inputs.json').read_text())
PLAN = json.loads((EVIDENCE / 'parser-cache-input.json').read_text())
CAP = 8 * 1024 ** 2
FLOOR = 1024 ** 3


def durable(path, value):
    with open(path, 'x', encoding='utf8') as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def usage(expected=None):
    root = PRIVATE.lstat()
    identity = [root.st_dev, root.st_ino]
    if not stat.S_ISDIR(root.st_mode) or (expected is not None and identity != expected):
        raise ValueError('PRIVATE_ROOT_IDENTITY_UNKNOWN')
    allocated = logical = 0
    vanished = 0
    def reject(error):
        nonlocal vanished
        path = Path(error.filename)
        if error.errno != 2 or path == PRIVATE or not path.is_relative_to(PRIVATE):
            raise error
        vanished += 1
    for parent, directories, files in os.walk(PRIVATE, followlinks=False, onerror=reject):
        try:
            directory_before = Path(parent).lstat()
        except FileNotFoundError:
            if Path(parent) == PRIVATE:
                raise
            vanished += 1
            directories[:] = []
            continue
        if not stat.S_ISDIR(directory_before.st_mode) or directory_before.st_uid != os.geteuid():
            raise ValueError('PRIVATE_DIRECTORY_IDENTITY_UNKNOWN')
        for name in directories + files:
            try:
                info = os.lstat(Path(parent) / name)
            except FileNotFoundError:
                vanished += 1
                continue
            allocated += info.st_blocks * 512
            logical += info.st_size
        try:
            directory_after = Path(parent).lstat()
        except FileNotFoundError:
            if Path(parent) == PRIVATE:
                raise
            vanished += 1
            directories[:] = []
            continue
        if not stat.S_ISDIR(directory_after.st_mode) or (directory_before.st_dev, directory_before.st_ino) != (directory_after.st_dev, directory_after.st_ino):
            raise ValueError('PRIVATE_DIRECTORY_IDENTITY_UNKNOWN')
    final = PRIVATE.lstat()
    if not stat.S_ISDIR(final.st_mode) or [final.st_dev, final.st_ino] != identity:
        raise ValueError('PRIVATE_ROOT_IDENTITY_UNKNOWN')
    space = os.statvfs(ROOT)
    return {'allocatedBytes': allocated, 'logicalBytes': logical, 'freeBytes': space.f_bavail * space.f_frsize, 'rootIdentity': identity, 'vanishedChildren': vanished, 'atomicSnapshot': False}


def bounded_file(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
            raise ValueError('EXPECTED_BOUNDED_REGULAR_FILE')
        data = stream.read(maximum + 1)
        after = os.fstat(stream.fileno())
        if len(data) != before.st_size or (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise ValueError('INPUT_CHANGED')
        return data


def worker():
    PRIVATE.mkdir(mode=0o700)
    initial = PRIVATE.stat()
    identity = [initial.st_dev, initial.st_ino]
    for name in ['store/v3', 'home', 'cache', 'tmp', 'project']:
        (PRIVATE / name).mkdir(parents=True, mode=0o700)
    for entry in PLAN['files']:
        source = Path(INPUTS['seed']) / entry['path']
        for parent in [source.parent, source.parent.parent, Path(INPUTS['seed'])]:
            if not stat.S_ISDIR(parent.lstat().st_mode):
                raise ValueError('CACHE_PARENT_NOT_DIRECTORY')
        data = bounded_file(source, entry['bytes'])
        actual = hashlib.sha256(data).hexdigest() if entry['kind'] == 'index' else 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
        if len(data) != entry['bytes'] or actual != entry.get('sha256', entry.get('integrity')):
            raise ValueError('CACHE_INTEGRITY')
        target = PRIVATE / 'store/v3' / entry['path']
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with open(target, 'xb') as stream:
            stream.write(data)
        os.chmod(target, 0o755 if entry.get('executable') else 0o644)
    project = PRIVATE / 'project'
    for original, target in [('parser-install-package.json', 'package.json'), ('parser-install-lock.json', 'pnpm-lock.yaml')]:
        (project / target).write_bytes((EVIDENCE / original).read_bytes())
    (project / 'pnpm-workspace.yaml').write_text('packages: []\n')
    config = PRIVATE / 'home/empty.npmrc'
    config.write_text('')
    env = {'PATH': str(Path(INPUTS['tools'][0]['realpath']).parent) + ':/usr/bin:/bin', 'HOME': str(PRIVATE / 'home'), 'TMPDIR': str(PRIVATE / 'tmp'), 'CI': 'true', 'LANG': 'C', 'npm_config_userconfig': str(config), 'npm_config_globalconfig': str(config), 'npm_config_update_notifier': 'false'}
    argv = [INPUTS['tools'][0]['realpath'], INPUTS['tools'][2]['realpath'], 'install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile', '--package-import-method=copy', '--store-dir', str(PRIVATE / 'store'), '--cache-dir', str(PRIVATE / 'cache'), '--config.manage-package-manager-versions=false']
    child = subprocess.Popen(argv, cwd=project, env=env, stdin=subprocess.DEVNULL)
    peak = {'allocatedBytes': 0, 'logicalBytes': 0, 'minimumFreeBytes': None, 'vanishedChildren': 0, 'samples': 0}
    while True:
        sample = usage(identity)
        peak['samples'] += 1
        peak['vanishedChildren'] += sample['vanishedChildren']
        peak['allocatedBytes'] = max(peak['allocatedBytes'], sample['allocatedBytes'])
        peak['logicalBytes'] = max(peak['logicalBytes'], sample['logicalBytes'])
        peak['minimumFreeBytes'] = min(peak['minimumFreeBytes'] or sample['freeBytes'], sample['freeBytes'])
        if max(sample['allocatedBytes'], sample['logicalBytes']) + 131072 > CAP or sample['freeBytes'] < FLOOR:
            raise RuntimeError('RESOURCE_OBSERVATION_LIMIT')
        if child.poll() is not None:
            break
        time.sleep(0.05)
    if child.returncode != 0:
        raise RuntimeError('OFFLINE_INSTALL_FAILED')
    if (project / 'pnpm-lock.yaml').read_bytes() != (EVIDENCE / 'parser-install-lock.json').read_bytes():
        raise RuntimeError('FROZEN_LOCK_BYTES_CHANGED')
    package = project / 'node_modules/yaml'
    if not package.resolve().is_relative_to(project):
        raise RuntimeError('INSTALLED_PACKAGE_ESCAPES_PRIVATE_ROOT')
    index = json.loads((Path(INPUTS['seed']) / INPUTS['cacheIndex']).read_text())
    for name, entry in index['files'].items():
        path = package / name
        data = bounded_file(path, entry['size'])
        if path.stat().st_nlink != 1 or 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode() != entry['integrity']:
            raise RuntimeError('INSTALLED_CONTENT_MISMATCH')
    durable(EVIDENCE / 'parser-install-worker-result.json', {'result': 'INSTALLED_VERIFIED', 'files': len(index['files']), 'rootIdentity': identity, 'peak': peak, 'measurement': '50ms observations plus post-process sample; vanished child names are missing samples, not exact totals or a reserved filesystem quota', 'namespace': str(PRIVATE), 'cleanup': 'retained exact private installation and diagnostics; no external resources'})


def main():
    if sys.argv[1:] != ['--entry'] or os.path.lexists(PRIVATE) or os.path.lexists(ALIAS):
        raise ValueError('EXCLUSIVE_NAMESPACE_REQUIRED')
    if not stat.S_ISDIR((ROOT / 'node_modules').lstat().st_mode):
        raise ValueError('OWN_NODE_MODULES_REQUIRED')
    for binding in INPUTS['tools']:
        path = Path(binding['path'])
        if str(path.resolve()) != binding['realpath'] or hashlib.sha256(path.read_bytes()).hexdigest() != binding['sha256']:
            raise ValueError('TOOL_BINDING_CHANGED')
    free = os.statvfs(ROOT)
    if free.f_bavail * free.f_frsize < FLOOR + CAP:
        raise ValueError('FRESH_SPACE_GATE')
    durable(EVIDENCE / 'parser-install-reservation.json', {'kind': 'svc06-yaml-private-install-once', 'namespace': str(PRIVATE), 'freeBytes': free.f_bavail * free.f_frsize, 'wallSeconds': 29.5, 'outputBytes': 131072, 'newBytesObservationLimit': CAP, 'inputsSHA256': hashlib.sha256((EVIDENCE / 'parser-install-inputs.json').read_bytes()).hexdigest()})
    worker()
    worker_path = EVIDENCE / 'parser-install-worker-result.json'
    expected = json.loads(worker_path.read_text())['rootIdentity'] if worker_path.exists() else None
    final_usage = usage(expected)
    if expected is None or final_usage['vanishedChildren']:
        raise RuntimeError('FINAL_RESOURCE_OBSERVATION_UNKNOWN')
    if max(final_usage['allocatedBytes'], final_usage['logicalBytes']) + 131072 > CAP:
        raise RuntimeError('FINAL_RESOURCE_LIMIT')
    os.symlink(PRIVATE / 'project/node_modules/yaml', ALIAS)
    durable(EVIDENCE / 'parser-install-receipt.json', {'result': 'INSTALLED_PENDING_OUTER_CONFIRMATION', 'finalUsage': final_usage, 'availabilityRequires': 'outer exit0/noFailure/owned absent/all EOF complete; otherwise namespace and alias remain unknown and must not be used', 'alias': str(ALIAS), 'realpath': str(ALIAS.resolve()), 'package': 'yaml@2.9.0', 'namespace': str(PRIVATE), 'retainedDiagnostics': True, 'noGlobalStoreWrites': True, 'noImportOrArtifactBuild': True})


if __name__ == '__main__':
    main()
