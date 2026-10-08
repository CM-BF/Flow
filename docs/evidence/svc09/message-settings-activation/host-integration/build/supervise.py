"""One reviewed artifact invocation; OPS14 alone owns the new child session."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent

def main(argv, *, settings=None):
    argument = '--execute-fixed-build' if settings is None else '--execute-settings-build-once'
    if argv != [argument]:
        raise ValueError('EXACT_BUILD_ARGUMENT_REQUIRED')
    # A second trusted caller shares this lifecycle. No CLI path overrides.
    root = HERE if settings is None else settings
    if settings is not None:
        assert root == HERE.parents[1] / 'settings-backend'
    delta = json.loads((root / ('inputs.json' if settings is None else 'build-inputs.json')).read_bytes())
    manifest = json.loads((root / ('preparation.json' if settings is None else 'build-preparation.json')).read_bytes())
    for binding in manifest['bindings']:
        path = root / binding['path']
        assert path.is_file() and not path.is_symlink()
        data = path.read_bytes()
        assert len(data) == binding['bytes']
        assert hashlib.sha256(data).hexdigest() == binding['sha256']
    destination = root if settings is None else root / 'build-once'
    assert not (destination / 'actual-first').exists()
    binding = delta['supervisor']
    module = Path(binding['path'])
    assert str(module.resolve()) == binding['realpath']
    assert hashlib.sha256(module.read_bytes()).hexdigest() == binding['sha256']
    spec = importlib.util.spec_from_file_location('svc09a_build_ops14', module)
    ops = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = ops
    spec.loader.exec_module(ops)
    if settings is not None:
        destination.mkdir(mode=0o700)
    output = destination / 'outer-report.json'
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    report = ops.supervise(ops.Launch(
        ('/opt/homebrew/opt/node@24/bin/node', str(root / ('entry.mjs' if settings is None else 'build-entry.mjs')), argument),
        str(HERE.parents[5]), {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin',
        'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1', 'NODE_DISABLE_COMPILE_CACHE': '1'},
        ops.Ownership.NEW_CHILD_SESSION), ops.Policy(420, .5, 2, 1024 * 1024))
    result = dict(vars(report))
    for key in ('stdout', 'stderr'):
        result[key] = getattr(report, key).decode('utf8', 'replace')
    # Termination/reap decisions precede durable recording; no fsync before stopping a timed-out group.
    with os.fdopen(fd, 'w', encoding='utf8') as stream:
        json.dump(result, stream, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    parent = os.open(str(destination), os.O_RDONLY)
    try:
        os.fsync(parent)
    finally:
        os.close(parent)
    print(json.dumps({'raw': str(output), 'exit_code': report.exit_code, 'owned_state': report.owned_state,
                      'eof': report.eof, 'first_failure': report.first_failure, 'elapsed_ms': report.elapsed_ms}))
    return 0 if report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values()) else 1

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
