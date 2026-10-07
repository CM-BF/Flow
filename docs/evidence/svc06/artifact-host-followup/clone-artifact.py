"""Copy this fixed artifact with the existing file-only CoW primitive; never install/build/fallback."""
import hashlib
import importlib.util
import json
import os
import stat
import sys
from pathlib import Path
sys.dont_write_bytecode = True
inputs = json.loads(Path(sys.argv[1]).read_text())
source = Path(inputs['sourceDirectory']) / 'backend-artifacts' / inputs['artifact']['artifactId']
target = Path(inputs['directory']) / 'backend-artifacts' / inputs['artifact']['artifactId']
manifest = source / 'manifest.json'
raw = manifest.read_bytes()
assert len(raw) == inputs['manifestBytes'] and hashlib.sha256(raw).hexdigest() == inputs['artifact']['manifestDigest']
content = json.loads(raw)
entries = content['inventory']['entries']
assert len(entries) == inputs['artifactEntries'] and content['inventory']['bytes'] == inputs['artifactLogicalBytes']
helper = source / 'root/tools/personal-preview/backend-release/clone-store.py'
assert hashlib.sha256(helper.read_bytes()).hexdigest() == inputs['cloneHelperSha256']
spec = importlib.util.spec_from_file_location('fixed_artifact_file_clone', helper)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
os.mkdir(target, 0o700); os.mkdir(target / 'root', 0o700)
logical = allocated = files = links = directories = 0
for entry in entries:
    relative = Path(entry['path'])
    assert not relative.is_absolute() and '..' not in relative.parts
    original, destination = source / 'root' / relative, target / 'root' / relative
    for parent in original.parents:
        if parent == source: break
        info = parent.lstat(); assert stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode)
    before = original.lstat()
    assert before.st_uid == os.getuid()
    if entry['kind'] == 'directory':
        assert stat.S_ISDIR(before.st_mode); os.mkdir(destination, 0o700); directories += 1
    elif entry['kind'] == 'file':
        assert stat.S_ISREG(before.st_mode) and before.st_size == entry['bytes'] and before.st_nlink == 1
        module.clone_selected_file(str(original), str(destination), before)
        after = destination.lstat(); assert after.st_nlink == 1 and (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino)
        assert after.st_size == entry['bytes']; logical += after.st_size; allocated += after.st_blocks * 512; files += 1
    elif entry['kind'] == 'symlink':
        assert stat.S_ISLNK(before.st_mode) and os.readlink(original) == entry['target'] and not os.path.isabs(entry['target'])
        assert os.path.commonpath((os.path.normpath(destination.parent / entry['target']), str(target / 'root'))) == str(target / 'root')
        os.symlink(entry['target'], destination); links += 1
    else:
        raise RuntimeError('UNSUPPORTED_FIXED_ARTIFACT_ENTRY')
module.clone_selected_file(str(manifest), str(target / 'manifest.json'), manifest.lstat())
info = (target / 'manifest.json').lstat(); assert info.st_nlink == 1
print(json.dumps({'regularFiles': files, 'directories': directories, 'internalSymlinks': links, 'regularLogicalBytes': logical + info.st_size, 'regularAllocatedBytes': allocated + info.st_blocks * 512, 'cloneFallback': False, 'physicalExclusiveBytes': None, 'finalManifestVerification': 'performed by original verifier immediately after copy'}))
