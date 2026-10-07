"""Build-only macOS clonefile wrapper: no ordinary-copy or hardlink fallback."""
import ctypes
import base64
import hashlib
import json
import os
import re
import stat
import sys

clone = ctypes.CDLL(None, use_errno=True).clonefile
clone.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
clone.restype = ctypes.c_int


def copy(source, target):
    info = os.lstat(source)
    if stat.S_ISDIR(info.st_mode):
        os.mkdir(target, 0o700)
        for name in os.listdir(source):
            copy(os.path.join(source, name), os.path.join(target, name))
    elif stat.S_ISREG(info.st_mode):
        if clone(os.fsencode(source), os.fsencode(target), 1) != 0:
            error = ctypes.get_errno()
            raise OSError(error, os.strerror(error))
        result = os.lstat(target)
        if result.st_nlink != 1 or (info.st_dev, info.st_ino) == (result.st_dev, result.st_ino):
            raise RuntimeError('CLONE_NOT_INDEPENDENT')
    else:
        raise RuntimeError('CLONE_REGULAR_FILES_ONLY')


def safe_parents(root, relative):
    current = root
    for part in ['.'] + relative.split('/')[:-1]:
        current = os.path.join(current, part)
        info = os.lstat(current)
        if not stat.S_ISDIR(info.st_mode):
            raise RuntimeError('CLONE_DIRECTORY_REQUIRED')


def verify_file(path, entry):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size != entry['bytes']:
            raise RuntimeError('CLONE_SOURCE_SIZE')
        sha = hashlib.sha256() if entry['kind'] == 'index' else hashlib.sha512()
        remaining = entry['bytes']
        while remaining:
            chunk = stream.read(min(65536, remaining))
            if not chunk:
                raise RuntimeError('CLONE_SOURCE_CHANGED')
            sha.update(chunk)
            remaining -= len(chunk)
        if stream.read(1):
            raise RuntimeError('CLONE_SOURCE_CHANGED')
        after = os.fstat(stream.fileno())
    identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns)
    if identity(before) != identity(after) or identity(after) != identity(os.lstat(path)):
        raise RuntimeError('CLONE_SOURCE_CHANGED')
    actual = sha.hexdigest() if entry['kind'] == 'index' else 'sha512-' + base64.b64encode(sha.digest()).decode('ascii')
    expected = entry['sha256'] if entry['kind'] == 'index' else entry['integrity']
    if actual != expected:
        raise RuntimeError('CLONE_SOURCE_INTEGRITY')
    return before


def selected_copy(source, target, manifest_path):
    with os.fdopen(os.open(manifest_path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > 32 * 1024 ** 2:
            raise RuntimeError('CLONE_PLAN_BUDGET')
        raw = stream.read(32 * 1024 ** 2 + 1)
    if len(raw) > 32 * 1024 ** 2:
        raise RuntimeError('CLONE_PLAN_BUDGET')
    plan = json.loads(raw)
    entries = plan.get('files')
    if plan.get('policy') != 'flow.backend-cache-clone.v1' or not isinstance(entries, list) or len(entries) > 200000:
        raise RuntimeError('CLONE_PLAN_INVALID')
    seen = set()
    total = 0
    for entry in entries:
        path = entry.get('path', '')
        if not re.fullmatch(r'files/[a-f0-9]{2}/[a-f0-9]{126}(?:-exec|-index\.json)?', path) or path in seen:
            raise RuntimeError('CLONE_PLAN_PATH')
        if type(entry.get('bytes')) is not int or entry['bytes'] < 0 or entry.get('kind') not in ('index', 'content'):
            raise RuntimeError('CLONE_PLAN_INVALID')
        if entry['kind'] == 'index':
            valid = path.endswith('-index.json') and re.fullmatch(r'[a-f0-9]{64}', entry.get('sha256', ''))
        else:
            valid = not path.endswith('-index.json') and re.fullmatch(r'sha512-[A-Za-z0-9+/]{86}==', entry.get('integrity', ''))
            if valid:
                content = base64.b64decode(entry['integrity'][7:], validate=True).hex()
                valid = path == 'files/' + content[:2] + '/' + content[2:] + ('-exec' if entry.get('executable') is True else '')
        if not valid:
            raise RuntimeError('CLONE_PLAN_INTEGRITY')
        total += entry['bytes']
        if total > 6 * 1024 ** 3:
            raise RuntimeError('CLONE_PLAN_BUDGET')
        seen.add(path)
    safe_parents(source, 'placeholder')
    os.mkdir(target, 0o700)
    for entry in entries:
        relative = entry['path']
        safe_parents(source, relative)
        original = os.path.join(source, relative)
        destination = os.path.join(target, relative)
        before = verify_file(original, entry)
        os.makedirs(os.path.dirname(destination), mode=0o700, exist_ok=True)
        safe_parents(target, relative)
        copy(original, destination)
        after = verify_file(destination, entry)
        source_after = os.lstat(original)
        if (before.st_dev, before.st_ino, before.st_ctime_ns) != (source_after.st_dev, source_after.st_ino, source_after.st_ctime_ns):
            raise RuntimeError('CLONE_SOURCE_CHANGED')
        if after.st_nlink != 1 or (before.st_dev, before.st_ino) == (after.st_dev, after.st_ino):
            raise RuntimeError('CLONE_NOT_INDEPENDENT')
    print(json.dumps({'selectedFiles': len(entries), 'logicalBytes': total, 'integrityVerified': True, 'ordinaryCopyFallback': False}))


if len(sys.argv) == 4:
    selected_copy(sys.argv[1], sys.argv[2], sys.argv[3])
else:
    copy(sys.argv[1], sys.argv[2])
